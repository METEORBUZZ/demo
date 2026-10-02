# AWS Deployment and IAM Policy Guide

This guide describes a least-privilege AWS access model for Gravity Todoist and its
infrastructure/deployment tools. It is documentation only: it does not create AWS
resources, IAM users, roles, or policies.

## Contents

1. [Architecture and policy principles](#1-architecture-and-policy-principles)
2. [Human IAM access](#2-human-iam-access)
3. [Terraform permissions](#3-terraform-permissions)
4. [Application and AWS services](#4-application-and-aws-services)
5. [CI/CD and operations tools](#5-cicd-and-operations-tools)
6. [Policy review checklist](#6-policy-review-checklist)
7. [Start-to-finish rollout](#7-start-to-finish-rollout)

## 1. Architecture and policy principles

The proposed AWS layout is:

- **VPC** for isolated networking, subnets, route tables, and security groups.
- **EC2** for the Node.js application or self-hosted tools, if EC2 is selected.
- **EKS** only if Kubernetes is adopted; Argo CD then deploys into that cluster.
- **CloudWatch** for AWS-side logs/metrics; Prometheus collects metrics and Grafana
  visualizes them.
- **ECR** as the private Docker image registry if images are stored in AWS.

Use **IAM roles with temporary credentials** for EC2, Terraform automation, CI/CD,
Ansible, and Kubernetes workloads wherever possible. Do not share IAM users between
people or services, and do not put access keys in source code, Terraform files,
container images, or CI logs. Require MFA for human access.

An IAM **identity policy** grants actions on resources. A **trust policy** controls
which identity can assume a role. Resource policies (for example, an S3 bucket
policy) control access at the resource. Use all three deliberately; a permissions
policy by itself does not establish who may assume a role.

> Policy examples below are starting points, not ready-to-apply production policies.
> Replace every placeholder, restrict resource ARNs to the actual account/region,
> validate with IAM Access Analyzer, and test in a non-production account first.

### Recommended policy units

Create small customer-managed policies for these distinct duties instead of one
large shared policy. Attach them to roles with matching trust policies; policy
names below are suggested names, not AWS-managed policies.

| Suggested policy | Attach to | Allow only |
| --- | --- | --- |
| `GravityTodoistTerraformState` | Terraform plan/apply roles | Read/write the project's state object; optional lock operations on the one lock mechanism |
| `GravityTodoistTerraformPlan` | Terraform plan role | Describe/read the project's managed resources and read state |
| `GravityTodoistTerraformApply` | Terraform apply role | Required create/update/delete actions for declared project resources; narrowly scoped `iam:PassRole` only when needed |
| `GravityTodoistEc2Runtime` | EC2 instance profile | SSM agent operations and only the application's explicitly selected AWS data access |
| `GravityTodoistEcrPush` | CI image-build role | Authenticate and upload images to one ECR repository |
| `GravityTodoistEcrPull` | EC2/EKS runtime role | Download images from one ECR repository |
| `GravityTodoistAnsibleSsm` | Ansible automation role | Send approved SSM commands to tagged project instances and read required SSM status |
| `GravityTodoistGrafanaCloudWatchRead` | Grafana data-source role | Read the required CloudWatch metrics/logs; no AWS resource mutation |
| `GravityTodoistPrometheusDiscovery` | Prometheus discovery role, only if needed | Read-only resource discovery for the chosen AWS targets |
| `GravityTodoistAppS3Prefix` | App workload role, only if S3 is used | Required object operations on the app's designated bucket prefix |
| `GravityTodoistAppDynamoDb` | App workload role, only if DynamoDB is used | Required item/query operations on the app's exact table and indexes |

The corresponding trust policies must separately limit **who can assume each
role**: an EC2 service principal for an instance profile, the selected OIDC
provider and verified claims for CI, and the approved human/federated identity
for manual Terraform operations. Do not attach all of these policies to one role.

## 2. Human IAM access

For team members, prefer **IAM Identity Center** (federated workforce access) with
MFA and permission sets. Avoid creating long-lived IAM users for individual
developers unless a documented legacy requirement makes them necessary.

Suggested human permission sets:

| Permission set | Intended use | Access boundary |
| --- | --- | --- |
| `GravityTodoistReadOnly` | Inspect deployments and diagnose issues | Read-only access to this project's resources and logs |
| `GravityTodoistDeveloper` | Develop and deploy to a sandbox | Sandbox resources only; no IAM administration |
| `GravityTodoistOperator` | Operate a deployed environment | Start/stop and inspect allowed workloads; no policy editing |
| `GravityTodoistAdmin` | Small number of cloud administrators | Separate, MFA-protected, audited administrative access |

Do not attach `AdministratorAccess` to normal developer, Terraform, CI, Grafana, or
application identities. Grant each person a named identity, use short-lived sessions,
and remove access when no longer required.

## 3. Terraform permissions

Terraform has **no single AWS policy**: its required permissions are the union of
the AWS API operations used by the resources in the Terraform configuration.
Maintain separate roles for:

1. **State bootstrap** — a tightly controlled, one-time role that creates the state
   bucket, encryption, access controls, and optional lock table.
2. **Terraform plan** — read/describe permissions for managed resources and access
   to read the project's state.
3. **Terraform apply** — the required create, update, and delete actions, scoped to
   this project's resources. Restrict who can assume it and require reviewed plans.

The Terraform execution role needs permissions for the configured VPC, EC2, security
groups, IAM instance profiles/roles (if defined by Terraform), S3, and any other
resources actually declared. Resource creation often needs `iam:PassRole` to attach
an approved EC2 role; scope this to the specific role ARN and, where supported,
`iam:PassedToService = ec2.amazonaws.com`. Do not grant unrestricted IAM
create/update/attach-policy permissions to the routine apply role.

### Terraform S3 state access

Use a dedicated, private state bucket with versioning and server-side encryption.
Enable public-access blocks and TLS-only access. Keep application files separate
from Terraform state. A state bucket policy should deny insecure transport and
public access, while the Terraform role is allowed only the state operations on
the exact bucket and state object prefix.

Example identity-policy shape for one state object (replace placeholders):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListOnlyProjectStatePrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::<STATE_BUCKET>",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["gravity-todoist/<ENV>/terraform.tfstate"]
        }
      }
    },
    {
      "Sid": "ManageOnlyProjectStateObject",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::<STATE_BUCKET>/gravity-todoist/<ENV>/terraform.tfstate"
    }
  ]
}
```

If the bucket uses a customer-managed KMS key, grant only the key operations needed
for state encryption/decryption on that key. Terraform state can contain secrets;
restrict access, enable versioning, and never commit state files.

If using a DynamoDB table for state locking with a Terraform backend that supports
that configuration, grant only the required item read/write/delete operations on
the exact lock table. Do not grant broad DynamoDB access. Terraform versions and
backend locking options differ; use the locking mechanism documented for the
selected Terraform version.

If using S3 native lock files, grant the necessary `GetObject`, `PutObject`, and
`DeleteObject` operations on the specific `.tflock` object separately; do not grant
state-object deletion just to support locking.

### EC2/VPC resource permissions

For the project stack, Terraform may need EC2 actions to describe and manage the
specific VPC, subnet, route, gateway, security-group, key-pair (if used), and
instance resources described in the IaC. Scope resource-level permissions where
AWS supports it and add project/environment tags. Some `Describe*` actions require
`Resource: "*"`, so constrain them with conditions where the service supports
conditions and keep them read-only.

Before apply, review the plan for:

- publicly reachable EC2 instances or unrestricted inbound security-group rules
- unintended IAM policy/role changes
- unencrypted storage or public S3 settings
- destructive replacements or deletes
- secrets or private keys in user data, plans, or state

## 4. Application and AWS services

### EC2 instance role for the Node.js app

Attach an instance profile role to EC2; do not put AWS credentials on the instance.
Give the app only the AWS access its implemented features need. The current app uses
SQLite locally, so it does **not** need DynamoDB permissions unless the app is
deliberately migrated to DynamoDB. If using S3 for uploads/backups, grant access only
to the relevant bucket prefix. Use Systems Manager (SSM) for administration instead
of opening SSH to the internet when practical.

### S3

Use separate buckets or prefixes for distinct purposes such as Terraform state,
user-uploaded objects, and backups. For an application role, grant only the required
read/write operations on the app's exact bucket prefix. Do not grant bucket-wide
delete or public access unless explicitly justified and reviewed.

### DynamoDB

If the application later uses DynamoDB, give its workload role only the specific
table actions it needs, such as `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, or
`Query`, on the exact table and indexes. Do not give the application
`CreateTable`, `DeleteTable`, or account-wide DynamoDB permissions at runtime.
Terraform provisioning may need separate table-management permissions.

### Docker and Amazon ECR

Docker itself does not require an AWS IAM user. If Docker pushes images to ECR, the
build identity needs ECR authentication and image upload permissions on the one
repository. The EC2/EKS runtime identity needs only image-pull permissions. Keep
build/push permissions separate from runtime/pull permissions.

### Kubernetes and Argo CD

If running Kubernetes on EKS, separate:

- **Cluster provisioning role:** Terraform-managed EKS/VPC/node resources and
  narrowly scoped `iam:PassRole` for the cluster/node roles it creates.
- **Cluster access role:** EKS access entry or `aws-auth`-equivalent configuration,
  scoped to the required Kubernetes groups/namespace permissions.
- **Argo CD role:** normally Kubernetes RBAC for deploying the approved application
  into its namespace. It should not receive general AWS account administration.
- **Workload role:** IAM Roles for Service Accounts (IRSA) or EKS Pod Identity for
  any pod that needs AWS services; scope permissions to that pod's needs.

Argo CD does not inherently need AWS permissions to apply Kubernetes manifests. Add
AWS permissions only when a documented integration requires them.

### Grafana and Prometheus

For Grafana reading AWS metrics, use a dedicated assumed role with only the required
CloudWatch read actions (for example, metric discovery and metric retrieval) and
scope access to the relevant account/region where possible. Avoid giving Grafana
write, IAM, EC2, S3, or DynamoDB permissions merely because it is a monitoring tool.

Prometheus usually scrapes metrics from configured targets and needs no AWS write
permissions. If it discovers AWS resources, give its discovery identity only the
necessary `Describe`/list permissions for the selected services. Keep dashboard
administration separate from AWS IAM administration.

## 5. CI/CD and operations tools

Use a distinct AWS role for each pipeline/service. Prefer OIDC federation from
Jenkins (when configured with an OIDC identity provider) or CircleCI over static
access keys. Restrict the trust policy to the exact organization/project, repository,
branch or environment, and audience claims supported by that provider. If federation
is unavailable, store short-lived/rotated credentials in an approved secret store,
restrict their access, and rotate them.

| Tool | AWS identity and minimum purpose |
| --- | --- |
| **Terraform** | Separate plan/apply roles; state access plus API permissions for only declared resources |
| **Docker** | No AWS identity for local builds; ECR push role for CI, ECR pull role for runtime |
| **Ansible** | Prefer SSM-based access; the automation role may use `ssm:SendCommand`/session operations on tagged project instances and only the required SSM reads |
| **Jenkins** | OIDC-assumed pipeline role for the specific task; split image publishing from infrastructure deployment |
| **CircleCI** | OIDC-assumed role restricted to the intended project/branch/environment; no shared IAM user keys |
| **Argo CD** | Kubernetes RBAC for deployment; AWS role only for a documented AWS integration |
| **Prometheus** | No AWS access for ordinary scraping; read-only discovery role only if AWS discovery is enabled |
| **Grafana** | Dedicated CloudWatch read-only role for metric dashboards, if CloudWatch is used |

Do not let both Jenkins and CircleCI share a powerful role by default. Each should
receive only the capabilities for the pipeline it runs.

## 6. Policy review checklist

Review every identity, trust, and resource policy before use:

- Name the person, workload, or pipeline that needs the permission.
- Grant only the actions required; prefer read-only permissions for observation.
- Scope resources to exact ARNs, tags, paths, tables, buckets, repositories, and
  environments wherever supported.
- Restrict role trust to known principals and federation claims; avoid wildcard
  principals.
- Require MFA for human users and short-lived credentials for automation.
- Deny public S3 access and insecure transport; encrypt state, storage, and logs.
- Keep production and non-production roles/resources separate.
- Review CloudTrail and IAM Access Analyzer findings; remove unused permissions.
- Protect Terraform plans/state and review changes before applying.
- Never paste real credentials into documentation, tickets, source control, or logs.

## 7. Start-to-finish rollout

1. **Choose scope:** decide whether the app runs on EC2 or EKS, whether S3 is for
   application objects, and whether DynamoDB is needed. The current app uses SQLite.
2. **Set up human access:** configure IAM Identity Center, MFA, and named
   least-privilege permission sets.
3. **Bootstrap Terraform state:** an authorized administrator creates the private,
   encrypted, versioned state bucket and optional lock mechanism; record the state
   location without exposing credentials.
4. **Create workload/pipeline roles:** create separate trust and permission policies
   for Terraform, EC2, CI, Ansible, Grafana, and any EKS workloads actually used.
5. **Provision infrastructure:** run `terraform fmt`, `terraform validate`, and
   `terraform plan`; review the plan, then apply through the approved role.
6. **Build and publish:** build the Node.js image with Docker and push to ECR only
   if ECR is selected. Keep image publishing separate from deployment permissions.
7. **Deploy:** use Ansible/SSM for EC2 configuration or Argo CD with scoped
   Kubernetes RBAC for EKS. Do not grant deploy tools account administrator access.
8. **Observe:** configure Prometheus scraping and Grafana dashboards; use a
   read-only CloudWatch role only if CloudWatch data sources are required.
9. **Operate and audit:** monitor CloudTrail, application/service logs, alerts,
   backups, policy usage, costs, and access reviews. Rotate or remove obsolete
   identities and credentials.
10. **Tear down safely:** review Terraform destroy plans carefully, preserve required
    data/state backups, and remove obsolete roles only after confirming they are
    unused.

### Command outline

Run commands from the relevant Terraform or application directory. These commands
are examples; the AWS account, backend, variables, and CI workflow must be configured
before execution.

```bash
# Confirm identity and region before making changes
aws sts get-caller-identity
aws configure list

# Terraform review and provisioning
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan -out=tfplan
terraform apply tfplan

# Image lifecycle (replace account, region, and repository)
aws ecr get-login-password --region <REGION> \
  | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
docker build -t gravity-todoist .
docker tag gravity-todoist:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<ECR_REPOSITORY>:<VERSION_TAG>
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<ECR_REPOSITORY>:<VERSION_TAG>

# Inspection
aws ec2 describe-instances --region <REGION>
aws s3 ls s3://<STATE_BUCKET>/gravity-todoist/<ENV>/
kubectl get pods -n <NAMESPACE>
```

Do not run `terraform apply`, `terraform destroy`, or production deployment commands
until the account, credentials, state backend, reviewed plan, and approvals have
been confirmed.
