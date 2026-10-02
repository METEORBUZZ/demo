# Production DevOps Project — 30 Day Implementation Plan

> **Project goal:** Build, containerize, secure, automate, deploy, monitor, and document an existing full-stack application using AWS, Terraform, Ansible, Docker, Jenkins, Kubernetes, Argo CD, Nginx/Ingress, Prometheus, Grafana, Loki, Trivy, Gitleaks, and SQLite.
>
> **Primary application stack:** Existing Frontend + Node.js/Express Backend + SQLite.
>
> **CI:** Jenkins only.
>
> **CD:** Argo CD only through GitOps.
>
> **Infrastructure as Code:** Terraform.
>
> **Configuration Management:** Ansible.
>
> **Containerization:** Docker.
>
> **Container orchestration:** Kubernetes.
>
> **Observability:** Prometheus + Grafana + Loki.
>
> **Security:** IAM, least privilege, Gitleaks, npm audit, Trivy, Kubernetes RBAC, NetworkPolicies, non-root containers, Secrets, TLS, resource controls.
>
> **Database constraint:** SQLite remains the application database for this project. The design explicitly treats SQLite as a single-writer/persistent-storage workload rather than pretending it is a horizontally scalable database. PostgreSQL migration is documented as a future scale-out path.

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [Engineering Goals](#2-engineering-goals)
3. [Architecture Principles](#3-architecture-principles)
4. [High-Level Architecture](#4-high-level-architecture)
5. [End-to-End Workflow](#5-end-to-end-workflow)
6. [Tool Responsibilities](#6-tool-responsibilities)
7. [Repository Strategy](#7-repository-strategy)
8. [AWS Network Architecture](#8-aws-network-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Infrastructure as Code Strategy](#10-infrastructure-as-code-strategy)
11. [Application Production Readiness](#11-application-production-readiness)
12. [Containerization Strategy](#12-containerization-strategy)
13. [Jenkins CI Strategy](#13-jenkins-ci-strategy)
14. [Container Security Strategy](#14-container-security-strategy)
15. [Kubernetes Architecture](#15-kubernetes-architecture)
16. [GitOps and Argo CD Strategy](#16-gitops-and-argo-cd-strategy)
17. [Networking and Ingress](#17-networking-and-ingress)
18. [Observability](#18-observability)
19. [SQLite Persistence and Backup](#19-sqlite-persistence-and-backup)
20. [Reliability and Failure Recovery](#20-reliability-and-failure-recovery)
21. [30-Day Implementation Plan](#21-30-day-implementation-plan)
22. [Definition of Done](#22-definition-of-done)
23. [Production Validation Checklist](#23-production-validation-checklist)
24. [Operational Runbooks](#24-operational-runbooks)
25. [Future Improvements](#25-future-improvements)

---

# 1. Project Overview

This project is designed as a production-oriented DevOps implementation rather than a simple application deployment.

The application already exists. The objective is to build the engineering platform around it so that a developer can commit code to GitHub and the system can automatically validate, secure, package, publish, deploy, observe, and recover the application.

The final workflow is:

```text
Developer
    |
    | git push
    v
GitHub Application Repository
    |
    | webhook
    v
Jenkins CI
    |
    +--> npm ci
    +--> lint
    +--> unit tests
    +--> integration tests
    +--> Gitleaks
    +--> npm audit
    +--> Docker build
    +--> Trivy image scan
    |
    v
Container Registry
    |
    | immutable/versioned image
    v
GitOps Repository
    |
    | desired image version
    v
Argo CD
    |
    | reconciliation
    v
Kubernetes Cluster
    |
    +--> Ingress / Nginx
    |
    +--> Node.js Application
    |
    +--> SQLite Persistent Volume
    |
    +--> Prometheus
    +--> Grafana
    +--> Loki
    |
    v
Users
```

AWS infrastructure is created separately through Terraform:

```text
Terraform
    |
    +--> VPC
    +--> Availability Zones
    +--> Public Subnets
    +--> Private Subnets
    +--> Internet Gateway
    +--> Routing
    +--> Security Groups
    +--> IAM-related infrastructure
    +--> Compute / Kubernetes infrastructure
```

Ansible is responsible for configuration of machines where machine-level configuration is required:

```text
Terraform
    |
    | creates infrastructure
    v
EC2 / Nodes
    |
    | Ansible
    v
Configured Linux Environment
```

---

# 2. Engineering Goals

The project has the following engineering goals:

## 2.1 Reproducibility

Infrastructure must not depend on manual AWS Console configuration.

If infrastructure needs to be recreated, Terraform should be able to recreate it from code.

```text
Code
  |
  v
terraform plan
  |
  v
terraform apply
  |
  v
Infrastructure
```

## 2.2 Automation

A normal application change should follow an automated path:

```text
Commit
  |
  v
CI
  |
  v
Security
  |
  v
Image
  |
  v
GitOps
  |
  v
CD
  |
  v
Kubernetes
```

## 2.3 Security by default

Security should not be a final-day activity.

Security is integrated into:

- AWS IAM
- Network design
- Git
- Jenkins
- Docker
- Kubernetes
- Secrets
- Application configuration
- Container scanning
- Dependency scanning
- Runtime permissions

## 2.4 Observability

A production engineer must be able to answer:

- Is the application up?
- How much traffic is it receiving?
- Is latency increasing?
- Are errors increasing?
- Are pods restarting?
- Is CPU high?
- Is memory high?
- What did the application log?
- What changed before the incident?

Therefore metrics and logs are part of the application platform.

## 2.5 Recovery

A production platform is not complete merely because deployment works.

We must demonstrate:

```text
Failure
  |
  v
Detection
  |
  v
Recovery
  |
  v
Validation
```

Examples:

- pod crash
- failed deployment
- unhealthy application
- deleted database copy
- security scan failure

---

# 3. Architecture Principles

## 3.1 Separation of responsibilities

Each tool must have a clear responsibility.

| Tool | Responsibility |
|---|---|
| AWS | Cloud infrastructure |
| Terraform | Infrastructure as Code |
| Ansible | Machine configuration |
| GitHub | Source control |
| Jenkins | Continuous Integration |
| Docker | Application packaging |
| Registry | Container image storage |
| Trivy | Container vulnerability scanning |
| Gitleaks | Secret detection |
| npm audit | Dependency security |
| Kubernetes | Runtime orchestration |
| Argo CD | GitOps Continuous Delivery |
| Nginx/Ingress | HTTP routing |
| Prometheus | Metrics |
| Grafana | Visualization |
| Loki | Logs |
| SQLite | Current application database |
| PVC | Persistent application storage |

The same responsibility should not be unnecessarily duplicated.

## 3.2 Jenkins does not deploy to Kubernetes

Jenkins is CI.

Jenkins should:

- test
- scan
- build
- publish

Jenkins should not perform the production deployment through:

```text
kubectl apply
```

The deployment responsibility belongs to Argo CD.

## 3.3 Argo CD does not build application images

Argo CD consumes the desired state.

It does not replace Jenkins.

```text
Jenkins = build and verify
Argo CD = deploy and reconcile
```

## 3.4 Git is the source of truth

Application source:

```text
Application Repository
```

Deployment desired state:

```text
GitOps Repository
```

Infrastructure source:

```text
Terraform Repository / Directory
```

Configuration:

```text
Ansible
```

---

# 4. High-Level Architecture

```text
                                      INTERNET
                                          |
                                          v
                                +-------------------+
                                | AWS Public Entry  |
                                | ALB / LB           |
                                +---------+---------+
                                          |
                                          v
                                +-------------------+
                                | Nginx / Ingress   |
                                +---------+---------+
                                          |
                                          v
             +----------------------------------------------------+
             |                    Kubernetes                       |
             |                                                    |
             |  +----------------+      +----------------------+  |
             |  | Node.js App    |      | Monitoring           |  |
             |  | Deployment     |      | Prometheus/Grafana   |  |
             |  +-------+--------+      +----------------------+  |
             |          |                                         |
             |          v                                         |
             |  +----------------+      +----------------------+  |
             |  | SQLite         |      | Logging              |  |
             |  | PVC            |      | Loki                 |  |
             |  +----------------+      +----------------------+  |
             |                                                    |
             |                    Argo CD                         |
             +------------------------+---------------------------+
                                      ^
                                      |
                                GitOps Repository
                                      ^
                                      |
                                   Jenkins
                                      ^
                                      |
                                   GitHub
```

AWS network boundary:

```text
+----------------------------------------------------------+
| VPC 10.0.0.0/16                                         |
|                                                          |
|  +---------------- AZ-A ----------------+                |
|  | Public Subnet                        |                |
|  | 10.0.1.0/24                          |                |
|  |                                      |                |
|  | Public entry components               |                |
|  +--------------------------------------+                |
|                                                          |
|  +---------------- AZ-B ----------------+                |
|  | Public Subnet                        |                |
|  | 10.0.2.0/24                          |                |
|  +--------------------------------------+                |
|                                                          |
|  +---------------- AZ-A ----------------+                |
|  | Private Subnet                       |                |
|  | 10.0.11.0/24                         |                |
|  |                                      |                |
|  | Kubernetes workloads / internal      |                |
|  | services                             |                |
|  +--------------------------------------+                |
|                                                          |
|  +---------------- AZ-B ----------------+                |
|  | Private Subnet                       |                |
|  | 10.0.12.0/24                         |                |
|  +--------------------------------------+                |
|                                                          |
+----------------------------------------------------------+
```

---

# 5. End-to-End Workflow

This section explains how the complete system works from a developer change to production runtime.

## 5.1 Developer change

A developer modifies application code.

```bash
git add .
git commit -m "feat: add appointment validation"
git push origin main
```

GitHub becomes the source-control event source.

## 5.2 Jenkins receives the event

GitHub sends a webhook to Jenkins.

Jenkins starts the pipeline.

```text
GitHub
   |
   | webhook
   v
Jenkins
```

## 5.3 CI validation

Jenkins executes:

```text
Checkout
   |
npm ci
   |
Lint
   |
Unit Tests
   |
Integration Tests
   |
Gitleaks
   |
npm audit
```

If any mandatory stage fails, the pipeline stops.

```text
Security/Test Failure
        |
        v
Pipeline FAILED
        |
        X
No image promotion
```

## 5.4 Docker image build

After code validation:

```text
Dockerfile
    |
    v
docker build
    |
    v
Application Image
```

The image is tagged with a traceable version.

Examples:

```text
app:1.0.0
app:1.0.1
app:git-a83f21c
```

## 5.5 Container vulnerability scanning

Trivy scans the image.

```text
Image
  |
  v
Trivy
  |
  +--> vulnerabilities
  +--> misconfiguration
  +--> packages
```

Pipeline policy decides which severity levels block promotion.

## 5.6 Image publishing

If all required checks pass:

```text
Jenkins
   |
   v
Container Registry
```

The image is now available for deployment.

## 5.7 GitOps update

The desired image version is updated in the GitOps repository.

Example:

```yaml
image:
  repository: example/app
  tag: "1.0.1"
```

The GitOps repository now says:

> Kubernetes should run version 1.0.1.

## 5.8 Argo CD reconciliation

Argo CD continuously compares:

```text
Git desired state
        vs
Kubernetes actual state
```

If they differ:

```text
Drift detected
     |
     v
Argo CD
     |
     v
Sync
     |
     v
Kubernetes
```

## 5.9 Kubernetes rollout

Kubernetes creates/replaces application pods according to the deployment strategy.

Readiness probes determine whether a pod is ready to receive traffic.

```text
New Pod
   |
   v
Startup
   |
   v
Readiness Check
   |
   +---- FAIL ---> No traffic
   |
   +---- PASS ---> Traffic allowed
```

## 5.10 User traffic

The request path is:

```text
User
 |
 v
AWS public entry
 |
 v
Ingress / Nginx
 |
 v
Kubernetes Service
 |
 v
Node.js Pod
 |
 v
SQLite
```

## 5.11 Monitoring

Prometheus collects metrics.

```text
Application / Kubernetes
          |
          v
     Prometheus
          |
          v
       Grafana
```

## 5.12 Logging

Application/container logs flow to Loki.

```text
Application
    |
    v
Container Logs
    |
    v
Loki
    |
    v
Grafana
```

---

# 6. Tool Responsibilities

## AWS

Provides the underlying cloud infrastructure.

AWS responsibilities include:

- VPC
- networking
- availability zones
- compute
- load balancing
- IAM
- storage/network primitives

## Terraform

Terraform owns infrastructure lifecycle.

Terraform should create:

- VPC
- subnets
- routing
- security groups
- required compute/network resources
- cluster infrastructure where applicable

Terraform state must be handled safely.

## Ansible

Ansible owns machine configuration.

Examples:

- package installation
- Docker installation
- OS configuration
- security hardening
- system configuration

## GitHub

GitHub stores source code and Git history.

It is not the CI engine.

## Jenkins

Jenkins is responsible for CI.

Pipeline:

```text
Checkout
→ Dependencies
→ Lint
→ Tests
→ Secret Scan
→ Dependency Scan
→ Docker Build
→ Image Scan
→ Registry Push
→ GitOps Update
```

## Docker

Docker packages the application into a repeatable runtime artifact.

## Kubernetes

Kubernetes manages runtime lifecycle.

It handles:

- scheduling
- service discovery
- restart
- desired replicas
- health checks
- configuration
- persistent storage integration
- resource limits

## Argo CD

Argo CD manages deployment through GitOps.

It continuously reconciles Git state with Kubernetes state.

## Nginx/Ingress

Handles HTTP routing into the Kubernetes application.

## Prometheus

Collects metrics.

## Grafana

Visualizes metrics and logs.

## Loki

Centralizes logs.

---

# 7. Repository Strategy

A two-repository model is recommended.

## 7.1 Application repository

Example:

```text
application-repo/
├── frontend/
├── backend/
├── database/
├── tests/
├── Dockerfile
├── docker-compose.yml
├── Jenkinsfile
├── package.json
├── .dockerignore
├── .gitignore
└── README.md
```

Responsibilities:

- application source
- tests
- Dockerfile
- CI definition
- developer documentation

## 7.2 GitOps repository

Example:

```text
gitops-repo/
├── base/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── pvc.yaml
│   ├── configmap.yaml
│   └── secret-template.yaml
│
└── overlays/
    ├── dev/
    └── prod/
```

Responsibilities:

- deployment manifests
- image versions
- environment-specific configuration
- Kubernetes desired state

## 7.3 Why separate repositories?

This separation provides a clear boundary:

```text
Application Team
       |
       v
Application Repo

Platform / Deployment
       |
       v
GitOps Repo
```

The application repository changes frequently.

The GitOps repository changes when the desired deployment state changes.

---

# 8. AWS Network Architecture

## 8.1 VPC

Initial CIDR:

```text
10.0.0.0/16
```

This gives a large private address space for future expansion.

## 8.2 Availability Zones

Use two Availability Zones for the production-style architecture.

Example:

```text
AZ-A
AZ-B
```

This prevents the entire architecture from depending on a single availability zone.

## 8.3 Public subnets

Example:

```text
10.0.1.0/24
10.0.2.0/24
```

Public routing points toward the Internet Gateway.

Public subnets are intended for resources that genuinely need public reachability.

## 8.4 Private subnets

Example:

```text
10.0.11.0/24
10.0.12.0/24
```

Application workloads should not receive direct public traffic.

The public entry point routes traffic toward private workloads.

## 8.5 Internet Gateway

The Internet Gateway provides VPC-level internet connectivity for public routing.

## 8.6 NAT consideration

A NAT Gateway is a paid AWS component and should not be treated as free.

Before enabling it, evaluate:

- outbound internet requirements
- development cost
- workload requirements
- alternative architecture

For a cost-conscious learning environment, NAT may be replaced or minimized where technically appropriate.

## 8.7 Route tables

Public route:

```text
0.0.0.0/0
      |
      v
Internet Gateway
```

Private route depends on the selected outbound architecture.

---

# 9. Security Architecture

Security is implemented in layers.

## 9.1 AWS layer

- IAM
- MFA
- least privilege
- security groups
- private subnets
- restricted ports
- no unnecessary public IPs

## 9.2 Git layer

- Gitleaks
- protected branches where appropriate
- no credentials committed
- `.env` excluded
- secret rotation procedure

## 9.3 Jenkins layer

Credentials must be stored in Jenkins Credentials.

Do not write:

```text
AWS_ACCESS_KEY=...
AWS_SECRET=...
DATABASE_PASSWORD=...
```

inside source code.

## 9.4 Docker layer

Container requirements:

- non-root user
- minimal image
- no secrets
- predictable startup
- healthcheck where appropriate

## 9.5 Kubernetes layer

- RBAC
- ServiceAccounts
- Secrets
- SecurityContext
- NetworkPolicies
- resource requests
- resource limits

## 9.6 Runtime layer

- HTTPS
- restricted endpoints
- health checks
- controlled access to admin tools

---

# 10. Infrastructure as Code Strategy

Terraform is the authoritative infrastructure definition.

## 10.1 Terraform lifecycle

```text
Modify Code
    |
    v
terraform fmt
    |
    v
terraform validate
    |
    v
terraform plan
    |
    v
Review
    |
    v
terraform apply
```

## 10.2 Terraform module strategy

```text
modules/
├── vpc/
├── security-groups/
├── compute/
└── kubernetes/
```

Modules should be reusable and have clear inputs/outputs.

## 10.3 State

Terraform state is critical infrastructure metadata.

It must not be treated as disposable.

Production implementation should use a secure remote state strategy where practical, with locking and access control.

---

# 11. Application Production Readiness

Before Kubernetes deployment, the application must be production-ready.

## 11.1 Environment configuration

Use environment variables for runtime configuration.

Example:

```text
NODE_ENV
PORT
DATABASE_PATH
JWT_SECRET
APP_URL
```

Secrets should not be hard-coded.

## 11.2 Health endpoint

Example:

```text
GET /health
```

Purpose:

> Process is alive.

## 11.3 Readiness endpoint

Example:

```text
GET /ready
```

Purpose:

> Application is ready to receive traffic.

## 11.4 Graceful shutdown

The Node.js application should handle termination signals and close resources cleanly.

Expected behavior:

```text
SIGTERM
  |
  v
Stop accepting traffic
  |
  v
Finish active work
  |
  v
Close resources
  |
  v
Exit
```

## 11.5 Logging

Logs should be structured enough to identify:

- timestamp
- request
- severity
- error
- useful context

Avoid logging secrets or sensitive credentials.

---

# 12. Containerization Strategy

## 12.1 Docker goals

The same image should work across environments.

```text
Developer
   |
   v
Docker Image
   |
   +--> Local
   +--> Test
   +--> Kubernetes
```

## 12.2 Image principles

- deterministic dependencies
- minimal runtime image
- non-root execution
- no secret files
- `.dockerignore`
- explicit versioning

## 12.3 Image tagging

Avoid relying only on:

```text
latest
```

Prefer:

```text
app:1.0.0
app:1.0.1
app:git-<commit>
```

Traceability is essential.

---

# 13. Jenkins CI Strategy

Jenkins pipeline structure:

```text
pipeline
 |
 +-- Checkout
 |
 +-- Install
 |
 +-- Lint
 |
 +-- Unit Test
 |
 +-- Integration Test
 |
 +-- Gitleaks
 |
 +-- npm audit
 |
 +-- Docker Build
 |
 +-- Trivy
 |
 +-- Push Image
 |
 +-- Update GitOps
```

## 13.1 Pipeline failure policy

If tests fail:

```text
FAIL
→ Stop
→ No image promotion
```

If Gitleaks detects a secret:

```text
FAIL
→ Stop
```

If a configured vulnerability policy is violated:

```text
FAIL
→ Stop
```

## 13.2 Jenkins credentials

Credentials belong in Jenkins credential storage.

Examples:

- registry credentials
- Git credentials
- deployment repository credentials

Secrets must not be printed into logs.

---

# 14. Container Security Strategy

## 14.1 Gitleaks

Purpose:

> Detect secrets in source history/files.

## 14.2 npm audit

Purpose:

> Identify vulnerable Node.js dependencies.

## 14.3 Trivy

Purpose:

> Scan container images for known vulnerabilities and related security issues.

## 14.4 Security gates

The pipeline should define a documented policy:

```text
Scanner
   |
   v
Severity
   |
   v
Policy
   |
   +--> Pass
   |
   +--> Fail
```

The exact severity threshold should be documented and periodically reviewed.

---

# 15. Kubernetes Architecture

## 15.1 Namespace strategy

Example:

```text
application
monitoring
logging
argocd
```

Namespaces provide logical isolation.

## 15.2 Deployment

The application is managed through a Deployment.

Responsibilities:

- desired pod state
- rollout
- restart
- replica configuration

## 15.3 Service

The Service provides stable networking to application pods.

```text
Ingress
   |
Service
   |
Pods
```

## 15.4 ConfigMap

Non-secret configuration.

## 15.5 Secret

Sensitive runtime configuration.

Secrets should be injected at runtime and not committed as plaintext credentials.

## 15.6 PVC

SQLite requires persistent storage.

```text
Node.js Pod
    |
    v
SQLite file
    |
    v
Persistent Volume
```

## 15.7 Resource management

Every production workload should define appropriate:

```text
requests
limits
```

This protects cluster stability.

## 15.8 Probes

Use:

- startup probe where required
- readiness probe
- liveness probe

They have different meanings and should not all call the same endpoint blindly.

---

# 16. GitOps and Argo CD Strategy

## 16.1 Desired state

GitOps repository describes what Kubernetes should run.

Example:

```yaml
image:
  tag: "1.0.1"
```

## 16.2 Actual state

Kubernetes reports what is currently running.

Argo CD compares both.

```text
Desired State
      |
      | compare
      v
Actual State
```

## 16.3 Drift

If someone manually changes Kubernetes:

```text
kubectl change
      |
      v
Actual != Git
      |
      v
Argo CD detects drift
```

The project should document the chosen drift/reconciliation policy.

## 16.4 Rollback

Rollback should be Git-based.

```text
Current Git commit
       |
       v
Revert
       |
       v
Argo CD
       |
       v
Previous deployment
```

This creates an auditable deployment history.

---

# 17. Networking and Ingress

The application should not expose the Node.js container directly to the internet.

Preferred flow:

```text
Internet
   |
   v
AWS Public Entry
   |
   v
Ingress / Nginx
   |
   v
Kubernetes Service
   |
   v
Node.js
```

Responsibilities must remain clear.

## 17.1 Public boundary

Only the required public entry point should be internet-facing.

## 17.2 Internal application

Node.js should remain inside the private application network.

## 17.3 HTTPS

Production traffic should use TLS.

Expected behavior:

```text
HTTP
  |
  v
HTTPS redirect
  |
  v
TLS termination
  |
  v
Application routing
```

---

# 18. Observability

Observability is divided into:

```text
Metrics
Logs
Events
```

## 18.1 Metrics

Prometheus collects metrics.

Important metrics:

- CPU
- memory
- pod restarts
- request count
- error count
- latency
- application availability

## 18.2 Grafana

Grafana provides dashboards.

Dashboards should answer operational questions rather than simply display every available metric.

## 18.3 Logs

Loki centralizes logs.

Search examples should allow operators to find:

- application errors
- HTTP errors
- startup failures
- authentication failures
- database errors

## 18.4 Alerting

Alerts should focus on actionable conditions.

Examples:

```text
Application unavailable
High error rate
Repeated pod restarts
High resource usage
```

---

# 19. SQLite Persistence and Backup

SQLite is intentionally retained because it is part of the existing application.

However, SQLite has architectural limitations for horizontal scaling.

Therefore:

```text
Current design
Single controlled application writer
        +
Persistent storage
        +
Backup/restore
```

## 19.1 Why not blindly scale replicas?

Multiple application replicas may create competing writers/access patterns against one SQLite database file.

Therefore the project should not claim:

> Kubernetes replicas automatically make SQLite horizontally scalable.

That would be architecturally misleading.

## 19.2 Backup

Backup should be:

- repeatable
- timestamped
- retained
- validated

## 19.3 Restore

Restore must be tested.

```text
Backup
  |
  v
Restore
  |
  v
SQLite validation
  |
  v
Application validation
```

## 19.4 Future database migration

Future architecture:

```text
SQLite
   |
   v
PostgreSQL
   |
   v
Multiple application replicas
   |
   v
Horizontal scaling
```

This is documented as a future evolution, not silently implemented in this project.

---

# 20. Reliability and Failure Recovery

Reliability is validated through deliberate failure testing.

## 20.1 Pod failure

```text
Pod killed
   |
   v
Kubernetes detects desired state mismatch
   |
   v
Replacement pod
```

## 20.2 Readiness failure

```text
Application unhealthy
   |
   v
Readiness probe fails
   |
   v
Service stops sending traffic
```

## 20.3 Deployment failure

```text
Bad version
   |
   v
Validation / health failure
   |
   v
Rollback
```

## 20.4 Backup failure

Backup jobs must produce observable success/failure results.

## 20.5 Recovery objective

The project should document:

- what is automatically recovered
- what requires operator action
- what data can be restored
- how long recovery is expected to take in the tested environment

---

# 21. 30-Day Implementation Plan

# Day 1 — Architecture, Requirements and AWS Foundation

## Objective

Establish the engineering baseline before creating infrastructure.

## Work

- review existing application
- identify frontend/backend/database boundaries
- identify runtime dependencies
- define production workflow
- define environment strategy
- define AWS region
- establish project naming convention
- configure AWS account security baseline
- configure MFA
- configure budget/cost alerts
- design VPC CIDR
- design subnet CIDRs
- document public/private boundaries

## Architecture decision

Initial VPC:

```text
10.0.0.0/16
```

Subnets:

```text
Public-A   10.0.1.0/24
Public-B   10.0.2.0/24
Private-A  10.0.11.0/24
Private-B  10.0.12.0/24
```

## Deliverables

```text
architecture.md
aws-network.md
security.md
decisions.md
```

## Validation

The architecture should explain:

- why public subnets exist
- why private subnets exist
- why Kubernetes workloads are private
- how internet traffic reaches the application
- how CI and CD are separated

---

# Day 2 — Terraform VPC Implementation

## Objective

Create the AWS network through Terraform.

## Work

Create:

- VPC
- Availability Zones
- public subnets
- private subnets
- Internet Gateway
- route tables
- subnet associations
- DNS support

## Validation

Run:

```bash
terraform fmt
terraform validate
terraform plan
terraform apply
```

Verify the AWS resources against Terraform outputs.

## Deliverable

Reusable Terraform VPC module.

---

# Day 3 — Routing and Network Security

## Objective

Create secure network boundaries.

## Work

- public routing
- private routing
- security groups
- ingress restrictions
- egress rules
- administrative access strategy
- NAT strategy evaluation

## Cost gate

Do not automatically enable expensive network components without reviewing their cost and necessity.

## Validation

Test:

- public reachability
- private reachability
- blocked ports
- expected egress

---

# Day 4 — Terraform Production Structure

## Objective

Turn Terraform from a single configuration into maintainable infrastructure code.

## Work

Create:

```text
environments/
modules/
```

Implement:

- variables
- outputs
- modules
- tagging
- naming
- environment separation
- validation

## Validation

A fresh engineer should be able to understand:

```text
What is being created?
Where is it defined?
What variables control it?
What outputs are produced?
```

---

# Day 5 — IAM and Least Privilege

## Objective

Secure AWS access.

## Work

- IAM roles
- policies
- developer access
- Terraform access
- workload roles
- MFA
- credential strategy
- access review

## Validation

Test that users/roles can perform required actions but cannot perform unrelated administrative actions.

---

# Day 6 — Ansible and Linux Configuration

## Objective

Configure machines consistently.

## Work

- Linux updates
- required packages
- Docker
- Git
- user configuration
- system hardening
- firewall configuration
- configuration validation

## Architecture

```text
Terraform
   |
   v
Machine
   |
   v
Ansible
   |
   v
Configured Machine
```

---

# Day 7 — Application Production Readiness

## Objective

Prepare the existing Node.js/Express application for automated deployment.

## Work

- environment configuration
- health endpoint
- readiness endpoint
- graceful shutdown
- logging
- error handling
- SQLite path
- dependency review

## Validation

Run locally and verify:

```text
/health
/ready
```

---

# Day 8 — Dockerization

## Objective

Create a production-grade application image.

## Work

- Dockerfile
- multi-stage build if applicable
- non-root user
- `.dockerignore`
- image metadata
- healthcheck
- startup command

## Validation

```bash
docker build
docker run
```

Verify application functionality from inside the container.

---

# Day 9 — Docker Compose and Local Production Test

## Objective

Validate the application before Kubernetes.

## Work

- compose configuration
- environment injection
- persistent SQLite storage
- application networking
- logs
- restart behavior

## Validation

```bash
docker compose up
docker compose down
docker compose up
```

Verify SQLite data persistence.

---

# Day 10 — Jenkins CI Foundation

## Objective

Build the first CI pipeline.

## Stages

```text
Checkout
Install
Lint
Test
Build
```

## Work

- Jenkins setup
- GitHub webhook
- Jenkins credentials
- Jenkinsfile
- pipeline agents
- build logs

## Validation

A GitHub push should automatically start Jenkins.

---

# Day 11 — DevSecOps CI

## Objective

Add security gates.

## Work

Add:

- Gitleaks
- npm audit
- Trivy
- security failure policy

## Pipeline

```text
Checkout
→ Install
→ Lint
→ Tests
→ Gitleaks
→ npm audit
→ Docker Build
→ Trivy
```

## Validation

Introduce controlled test failures and verify that Jenkins blocks promotion.

---

# Day 12 — Container Registry and Versioning

## Objective

Publish immutable, traceable application images.

## Work

- registry configuration
- authentication
- version tags
- commit SHA tags
- image push

## Validation

Confirm:

```text
Git commit
↔ image tag
↔ Jenkins build
```

---

# Day 13 — Kubernetes Foundation

## Objective

Introduce Kubernetes runtime architecture.

## Work

- cluster preparation
- namespaces
- application namespace
- monitoring namespace
- logging namespace
- Argo CD namespace

## Design consideration

Because SQLite is retained, the initial application deployment must not blindly scale horizontally.

---

# Day 14 — Kubernetes Application Deployment

## Objective

Run the application in Kubernetes.

## Manifests

```text
namespace.yaml
deployment.yaml
service.yaml
configmap.yaml
secret.yaml
pvc.yaml
ingress.yaml
```

## Work

- Deployment
- Service
- ConfigMap
- Secret
- PVC
- probes
- resources

## Validation

Verify:

```text
Pod Running
Service reachable
Readiness passing
SQLite persistent
```

---

# Day 15 — Kubernetes Security and Reliability

## Objective

Harden the workload.

## Work

- RBAC
- ServiceAccount
- SecurityContext
- non-root
- NetworkPolicy
- resource requests
- resource limits
- probes

## Validation

Test:

- unauthorized access
- pod restart
- readiness failure
- resource behavior

---

# Day 16 — Infrastructure and Kubernetes Integration

## Objective

Connect AWS infrastructure provisioning with the runtime platform.

## Work

- infrastructure outputs
- node/network dependencies
- security group relationships
- cluster connectivity
- infrastructure documentation

## Validation

Terraform-managed infrastructure must support the Kubernetes deployment without undocumented manual dependencies.

---

# Day 17 — Argo CD Installation

## Objective

Introduce GitOps CD.

## Work

- install Argo CD
- configure access
- connect Git repository
- create application definition
- establish synchronization policy

## Important rule

Jenkins must not deploy directly to Kubernetes.

---

# Day 18 — GitOps Repository

## Objective

Create the Kubernetes desired-state repository.

## Work

- base manifests
- overlays
- environment configuration
- image version
- Argo CD application configuration

## Validation

Changing the desired image in Git should result in Argo CD detecting the change.

---

# Day 19 — Full CI/CD Integration

## Objective

Connect the entire software delivery pipeline.

## Workflow

```text
GitHub
  ↓
Jenkins
  ↓
Test
  ↓
Security
  ↓
Docker
  ↓
Registry
  ↓
GitOps
  ↓
Argo CD
  ↓
Kubernetes
```

## Validation

Make a real application change and trace it from commit to running pod.

---

# Day 20 — Rollout and Rollback

## Objective

Prove deployment recovery.

## Work

- rollout
- deployment history
- failure simulation
- Git revert
- Argo CD sync
- application verification

## Validation

Deploy a controlled bad version and restore the previous version.

---

# Day 21 — Ingress and Networking

## Objective

Expose only the required application entry point.

## Work

- AWS public entry
- Ingress
- Nginx where selected
- service routing
- internal service access

## Validation

Verify that:

```text
Internet
→ public entry
→ ingress
→ service
→ application
```

works while direct application exposure is blocked.

---

# Day 22 — HTTPS and Application Security

## Objective

Secure external traffic.

## Work

- TLS
- HTTPS
- HTTP redirect
- security headers
- domain integration if available

## Validation

Verify:

```text
HTTP → HTTPS
```

and confirm certificates and application routing.

---

# Day 23 — Prometheus Monitoring

## Objective

Implement infrastructure and application metrics.

## Work

Install/configure:

- Prometheus
- metric scraping
- Kubernetes metrics
- application metrics where available

## Validation

Verify CPU, memory, pod, restart, request and error metrics.

---

# Day 24 — Grafana and Alerting

## Objective

Create operational dashboards.

## Work

Dashboards:

- Kubernetes overview
- application overview
- resource usage
- request/error overview

Alerts:

- application unavailable
- high error rate
- repeated restarts
- high resource usage

---

# Day 25 — Loki Centralized Logging

## Objective

Centralize application and container logs.

## Work

- Loki
- log collection
- Grafana integration
- useful queries
- log retention considerations

## Validation

Generate an application error and find it through centralized logging.

---

# Day 26 — SQLite Backup and Restore

## Objective

Implement data protection.

## Work

- backup script/job
- timestamped backups
- retention
- restore process
- integrity validation

## Validation

```text
Create data
→ Backup
→ Simulate loss
→ Restore
→ Validate application
```

---

# Day 27 — Security Hardening Review

## Objective

Perform a complete security review.

## Review

### AWS

- IAM
- MFA
- security groups
- private subnets
- public exposure

### Git

- secrets
- Gitleaks
- repository permissions

### Docker

- non-root
- image vulnerabilities
- minimal runtime

### Kubernetes

- RBAC
- Secrets
- NetworkPolicies
- security context
- resource limits

### CI/CD

- Jenkins credentials
- scan gates
- registry access
- GitOps permissions

---

# Day 28 — Failure Testing

## Objective

Test the platform under controlled failure.

## Scenarios

### Pod failure

```text
kill pod
→ Kubernetes recreates
```

### Application failure

```text
readiness fails
→ traffic removed
```

### Deployment failure

```text
bad image
→ rollout failure
→ rollback
```

### Data failure

```text
SQLite loss simulation
→ restore backup
```

### CI security failure

```text
secret/vulnerability
→ Jenkins fails
```

Every test must have:

```text
Expected result
Actual result
Evidence
Recovery
```

---

# Day 29 — End-to-End Production Validation

## Objective

Validate the entire platform as one system.

## Test

```text
Developer
  ↓
GitHub
  ↓
Jenkins
  ↓
Tests
  ↓
Security
  ↓
Docker
  ↓
Registry
  ↓
GitOps
  ↓
Argo CD
  ↓
Kubernetes
  ↓
Ingress
  ↓
Node.js
  ↓
SQLite
```

Also validate:

```text
Metrics
Logs
Alerts
Backup
Restore
Rollback
HTTPS
```

---

# Day 30 — Production Review and Documentation

## Objective

Convert the implementation into a professional, explainable DevOps project.

## Documentation

```text
docs/
├── architecture.md
├── aws-infrastructure.md
├── networking.md
├── iam-security.md
├── terraform.md
├── ansible.md
├── docker.md
├── jenkins.md
├── security-scanning.md
├── kubernetes.md
├── argocd.md
├── ingress.md
├── monitoring.md
├── logging.md
├── backup-restore.md
├── disaster-recovery.md
├── troubleshooting.md
└── runbook.md
```

## Final review

The project should answer:

1. How does a code change reach production?
2. Who creates AWS infrastructure?
3. Who configures servers?
4. Who runs CI?
5. Who builds the Docker image?
6. Who scans the image?
7. Where is the image stored?
8. Who performs deployment?
9. Where is desired Kubernetes state stored?
10. How does Argo CD detect changes?
11. How does Kubernetes determine application health?
12. How is traffic routed?
13. How are logs collected?
14. How are metrics collected?
15. How is SQLite persisted?
16. How is SQLite restored?
17. What happens when a pod crashes?
18. What happens when a deployment fails?
19. Where are secrets stored?
20. Which components are publicly accessible?
21. Which components remain private?
22. How is infrastructure recreated?
23. How is the application rolled back?
24. How do we prove the system works?

---

# 22. Definition of Done

The project is considered complete only when all major requirements are demonstrated.

## Infrastructure

- [ ] AWS VPC created through Terraform
- [ ] Two Availability Zones
- [ ] Public subnets
- [ ] Private subnets
- [ ] Routing implemented
- [ ] Security groups configured
- [ ] Infrastructure documented

## Configuration

- [ ] Ansible playbooks implemented
- [ ] Linux configuration automated
- [ ] Security baseline applied

## Application

- [ ] Production configuration
- [ ] Health endpoint
- [ ] Readiness endpoint
- [ ] Graceful shutdown
- [ ] Structured logging
- [ ] SQLite persistence

## Docker

- [ ] Dockerfile
- [ ] Non-root user
- [ ] Minimal image
- [ ] `.dockerignore`
- [ ] Local container validation

## CI

- [ ] Jenkins
- [ ] GitHub webhook
- [ ] Automated tests
- [ ] Gitleaks
- [ ] npm audit
- [ ] Docker build
- [ ] Trivy

## Registry

- [ ] Image pushed
- [ ] Versioned tags
- [ ] Traceable commit/image relationship

## Kubernetes

- [ ] Namespace
- [ ] Deployment
- [ ] Service
- [ ] ConfigMap
- [ ] Secret
- [ ] PVC
- [ ] Probes
- [ ] Resources
- [ ] RBAC
- [ ] NetworkPolicy

## GitOps

- [ ] GitOps repository
- [ ] Argo CD
- [ ] Automated reconciliation
- [ ] Deployment history
- [ ] Rollback procedure

## Networking

- [ ] Public entry point
- [ ] Ingress/Nginx
- [ ] Internal service
- [ ] HTTPS
- [ ] Direct application exposure blocked

## Observability

- [ ] Prometheus
- [ ] Grafana
- [ ] Loki
- [ ] Dashboards
- [ ] Alerts
- [ ] Centralized logs

## Data Protection

- [ ] SQLite backup
- [ ] Backup retention
- [ ] Restore process
- [ ] Restore test

## Reliability

- [ ] Pod failure tested
- [ ] Readiness failure tested
- [ ] Deployment rollback tested
- [ ] Backup restore tested
- [ ] Security pipeline failure tested

---

# 23. Production Validation Checklist

## Architecture

- [ ] Every component has a defined responsibility.
- [ ] No unnecessary duplicate tooling.
- [ ] Public/private boundaries are documented.
- [ ] Data persistence is documented.
- [ ] CI/CD boundaries are documented.

## Security

- [ ] No secrets in Git.
- [ ] No secrets in Docker image.
- [ ] No unnecessary public ports.
- [ ] IAM follows least privilege.
- [ ] Kubernetes RBAC is configured.
- [ ] Containers do not run as root.
- [ ] Vulnerability scanning is enabled.
- [ ] HTTPS is enabled.

## Delivery

- [ ] Every build is traceable.
- [ ] Every image has a version.
- [ ] Deployment state is Git-controlled.
- [ ] Argo CD is the CD authority.
- [ ] Rollback is documented.

## Operations

- [ ] Metrics are available.
- [ ] Logs are searchable.
- [ ] Alerts are actionable.
- [ ] Health checks work.
- [ ] Backups are tested.
- [ ] Failure scenarios are documented.

---

# 24. Operational Runbooks

The final project should contain simple operator procedures.

## 24.1 Application deployment

```text
1. Push code.
2. Confirm Jenkins build.
3. Confirm security scans.
4. Confirm image publication.
5. Confirm GitOps image update.
6. Confirm Argo CD sync.
7. Confirm Kubernetes rollout.
8. Confirm readiness.
9. Confirm application health.
```

## 24.2 Failed Jenkins build

```text
1. Open Jenkins build.
2. Identify failed stage.
3. Review logs.
4. Fix source/configuration.
5. Commit fix.
6. Run pipeline again.
```

## 24.3 Failed security scan

```text
1. Identify scanner.
2. Identify finding.
3. Determine whether it is valid.
4. Upgrade/fix dependency or image.
5. Re-run pipeline.
```

## 24.4 Failed deployment

```text
1. Check Argo CD.
2. Check Kubernetes events.
3. Check pod status.
4. Check logs.
5. Check readiness/liveness.
6. Revert GitOps change if required.
7. Confirm previous version.
```

## 24.5 Pod crash

```text
1. Check pod status.
2. Check restart count.
3. Check logs.
4. Check previous container logs.
5. Check resource limits.
6. Check configuration/secrets.
7. Confirm replacement pod becomes ready.
```

## 24.6 SQLite restore

```text
1. Stop or isolate application writer.
2. Identify valid backup.
3. Restore database.
4. Verify SQLite integrity.
5. Start application.
6. Run health/readiness checks.
7. Validate application data.
8. Record recovery evidence.
```

---

# 25. Future Improvements

The current project intentionally keeps SQLite because it is the existing application's database.

For a future high-scale production architecture, the evolution would be:

```text
Current

Node.js
   |
SQLite
   |
Persistent Volume
```

to:

```text
Future

              +-------------------+
              | Load Balancer     |
              +---------+---------+
                        |
              +---------v---------+
              | Kubernetes       |
              |                  |
              | Node.js Replica  |
              | Node.js Replica  |
              | Node.js Replica  |
              +---------+---------+
                        |
                        v
                  PostgreSQL
```

Potential future improvements:

- PostgreSQL
- database migrations
- managed database
- horizontal application scaling
- autoscaling
- distributed caching
- message queue
- CDN
- WAF
- secrets manager
- centralized security monitoring
- SLO/SLI definitions
- advanced tracing with OpenTelemetry
- blue/green or canary deployment
- multi-environment promotion
- disaster recovery across regions

These are intentionally not required for the first 30-day implementation unless the project scope is expanded.

---

# Final Architecture Summary

The final engineering model is:

```text
                         +----------------+
                         |    Developer   |
                         +-------+--------+
                                 |
                                 v
                         +----------------+
                         |     GitHub     |
                         | Source Control |
                         +-------+--------+
                                 |
                              Webhook
                                 |
                                 v
                         +----------------+
                         |    Jenkins     |
                         |      CI        |
                         +-------+--------+
                                 |
                +----------------+----------------+
                |                |                |
                v                v                v
             Tests          Gitleaks          npm audit
                |                |                |
                +----------------+----------------+
                                 |
                                 v
                         +----------------+
                         | Docker Build   |
                         +-------+--------+
                                 |
                                 v
                         +----------------+
                         |     Trivy      |
                         | Image Security |
                         +-------+--------+
                                 |
                                 v
                         +----------------+
                         |    Registry    |
                         | Versioned Img  |
                         +-------+--------+
                                 |
                                 v
                         +----------------+
                         | GitOps Repo    |
                         | Desired State  |
                         +-------+--------+
                                 |
                                 v
                         +----------------+
                         |    Argo CD     |
                         |      CD        |
                         +-------+--------+
                                 |
                          Reconciliation
                                 |
                                 v
                 +---------------+----------------+
                 |        Kubernetes Cluster      |
                 |                                |
                 |  +--------------------------+  |
                 |  | Nginx / Ingress          |  |
                 |  +------------+-------------+  |
                 |               |                |
                 |  +------------v-------------+  |
                 |  | Node.js / Express       |  |
                 |  +------------+-------------+  |
                 |               |                |
                 |        +------v------+         |
                 |        | SQLite PVC  |         |
                 |        +-------------+         |
                 |                                |
                 |  Prometheus → Grafana          |
                 |  Loki → Grafana                |
                 +--------------------------------+

                         AWS Foundation
                              |
                         Terraform
                              |
          +-------------------+-------------------+
          |                                       |
       Public                                  Private
       Subnets                                 Subnets
          |                                       |
     Public Entry                         Kubernetes/Workloads
          |
     Internet Gateway

                    Configuration Layer
                           |
                         Ansible
                           |
                    Linux / Nodes
```

# Engineering Principle

The most important principle of this project is:

```text
Terraform creates infrastructure.
Ansible configures machines.
GitHub stores source code.
Jenkins validates and builds software.
Docker packages software.
Trivy/Gitleaks/npm audit enforce security checks.
Registry stores versioned artifacts.
GitOps stores desired deployment state.
Argo CD deploys and reconciles.
Kubernetes runs the application.
Nginx/Ingress routes traffic.
Prometheus collects metrics.
Grafana visualizes metrics and logs.
Loki centralizes logs.
SQLite stores current application data.
Backup/restore protects application data.
```

The result is not simply:

> "Application deployed on AWS."

The result is:

> **A reproducible, automated, secure, observable, GitOps-driven DevOps delivery platform around an existing full-stack application.**
