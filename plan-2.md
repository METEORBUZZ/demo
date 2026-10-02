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

This is the execution schedule for the complete project.

The 30 days are intentionally arranged in dependency order. We do not start Kubernetes before the application is container-ready, and we do not start GitOps before Kubernetes manifests exist. Similarly, monitoring and disaster recovery are implemented after the application is running so that they monitor the real workload.

Every day has five things:

1. **Objective** — what we are trying to achieve.
2. **Work to perform** — exact engineering activities.
3. **Implementation output** — files/resources that should exist by the end of the day.
4. **Validation gate** — how we prove the day's work is correct.
5. **Documentation** — what must be recorded for another engineer.

---

## Day 1 — Project Discovery, Architecture and AWS Foundation

### Objective

Understand the existing application and freeze the target production architecture before creating infrastructure.

### Morning — Application discovery

Inspect:

- frontend structure
- Node.js/Express backend
- package.json
- environment variables
- API routes
- database access
- SQLite file location
- existing tests
- build commands
- start commands
- existing Docker configuration, if any

Create a dependency map:

```text
Frontend
   |
   v
Node.js / Express
   |
   v
SQLite
```

Identify:

- application port
- API base URL
- runtime dependencies
- build dependencies
- database files
- writable directories
- required secrets

### Afternoon — Architecture design

Freeze the initial architecture:

```text
GitHub
   |
   v
Jenkins
   |
   v
Docker + Security Scans
   |
   v
Container Registry
   |
   v
GitOps Repository
   |
   v
Argo CD
   |
   v
Kubernetes
   |
   v
Ingress
   |
   v
Node.js
   |
   v
SQLite PVC
```

AWS network:

```text
VPC 10.0.0.0/16
|
+-- AZ-A
|   +-- Public  10.0.1.0/24
|   +-- Private 10.0.11.0/24
|
+-- AZ-B
    +-- Public  10.0.2.0/24
    +-- Private 10.0.12.0/24
```

### AWS account foundation

Perform:

- account security review
- MFA
- IAM strategy
- billing/cost alerts
- project naming convention
- resource tagging convention
- region selection
- environment naming

Do not start creating application servers manually.

### Files to create

```text
docs/
├── architecture.md
├── requirements.md
├── decisions.md
├── aws-network.md
└── security.md
```

### Validation gate

By the end of Day 1, another engineer should be able to answer:

- What are we deploying?
- Where will it run?
- How will traffic enter?
- How will CI work?
- How will CD work?
- Where is the database?
- Which resources are public?
- Which resources are private?
- Why are we using each major tool?

### Day 1 Definition of Done

- [ ] Existing application understood.
- [ ] Architecture diagram created.
- [ ] AWS network design approved.
- [ ] CI/CD responsibility boundaries defined.
- [ ] AWS security baseline started.
- [ ] Cost-control strategy documented.

---

## Day 2 — Terraform Foundation and VPC Creation

### Objective

Create the AWS network entirely through Terraform.

### Work

Create Terraform project structure:

```text
terraform/
├── providers.tf
├── variables.tf
├── outputs.tf
├── main.tf
├── versions.tf
├── terraform.tfvars.example
└── modules/
    └── vpc/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

Create:

- VPC
- CIDR
- DNS support
- DNS hostnames
- Availability Zones
- public subnets
- private subnets
- Internet Gateway
- route tables
- subnet associations

### Target CIDRs

```text
VPC:
10.0.0.0/16

Public-A:
10.0.1.0/24

Public-B:
10.0.2.0/24

Private-A:
10.0.11.0/24

Private-B:
10.0.12.0/24
```

### Terraform workflow

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

### Important rule

Do not manually create the VPC and then copy it into Terraform.

Terraform must be the creator.

### Validation gate

Check:

- VPC exists.
- CIDR is correct.
- Two AZs are used.
- Four expected subnets exist.
- Public route table exists.
- Private route tables exist.
- Internet Gateway is attached.
- Terraform outputs match AWS.

### Day 2 Definition of Done

- [ ] VPC created by Terraform.
- [ ] Subnets created by Terraform.
- [ ] Routing created by Terraform.
- [ ] No undocumented manual network resources.
- [ ] `terraform plan` is clean after apply.

---

## Day 3 — AWS Routing, Security Groups and Private Network Design

### Objective

Turn the raw VPC into a controlled network.

### Work

Design security groups around traffic flow rather than opening broad ports.

Conceptual model:

```text
Internet
   |
   v
Public Entry SG
   |
   v
Ingress / Kubernetes SG
   |
   v
Application SG
```

Define:

- inbound rules
- outbound rules
- application ports
- administrative access
- internal-only traffic
- health-check traffic

### Public/private boundary

Public:

- public load-balancing entry point
- components that genuinely need public access

Private:

- Kubernetes workloads
- Node.js application
- SQLite storage
- Argo CD
- Prometheus
- Grafana
- Loki
- internal administration

### NAT decision

Evaluate outbound requirements before selecting a NAT solution.

Document:

- why outbound internet is needed
- which workloads need it
- estimated AWS cost
- whether NAT Gateway, NAT instance, or another design is appropriate

Do not call NAT Gateway a free service.

### Validation gate

Test the intended network model:

```text
Internet → Public Entry       ALLOWED
Internet → Node.js directly   BLOCKED
Internet → Jenkins directly   BLOCKED
Internet → Grafana directly   BLOCKED
Private → required outbound  ALLOWED
```

### Files

```text
docs/networking.md
docs/security-groups.md
```

### Day 3 Definition of Done

- [ ] Security groups implemented.
- [ ] Public/private boundaries documented.
- [ ] Direct application exposure prevented.
- [ ] NAT strategy documented.
- [ ] Network validation completed.

---

## Day 4 — Terraform Production Structure

### Objective

Make infrastructure code maintainable by another engineer.

### Work

Refactor Terraform into reusable modules and environments.

Target:

```text
terraform/
├── environments/
│   ├── dev/
│   └── prod/
│
├── modules/
│   ├── vpc/
│   ├── security-groups/
│   ├── compute/
│   └── kubernetes/
│
└── shared/
```

Implement:

- variables
- outputs
- module interfaces
- environment variables
- naming
- tagging
- validation
- sensitive values

### Terraform quality checks

```bash
terraform fmt -check
terraform validate
terraform plan
```

### Validation gate

A new engineer should be able to locate:

```text
Where is VPC defined?
Where are subnet CIDRs defined?
Where are security groups defined?
Which values change between dev and prod?
What outputs are consumed by other components?
```

### Day 4 Definition of Done

- [ ] Modular Terraform structure.
- [ ] Dev/prod separation prepared.
- [ ] Naming and tagging standardized.
- [ ] Terraform validation passes.
- [ ] Documentation updated.

---

## Day 5 — IAM and Least-Privilege Access

### Objective

Secure AWS access before adding more infrastructure.

### Work

Design access for:

```text
Human Engineer
Terraform
Infrastructure Workloads
CI/CD Components
```

Implement where applicable:

- IAM roles
- IAM policies
- least privilege
- MFA
- workload roles
- access boundaries
- credential storage strategy

### Rules

Never store:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

inside:

- Git
- Dockerfiles
- Kubernetes manifests
- application source
- README files

### Validation gate

Review every role:

```text
Who uses this role?
What can it do?
Why does it need that permission?
Can the permission be reduced?
```

### Day 5 Definition of Done

- [ ] IAM design documented.
- [ ] MFA configured.
- [ ] No static secrets in source.
- [ ] Least-privilege review completed.
- [ ] Terraform credentials strategy documented.

---

## Day 6 — Ansible and Linux Configuration

### Objective

Separate infrastructure creation from server configuration.

### Responsibility boundary

```text
Terraform
    |
    | creates
    v
EC2 / Nodes
    |
    | configures
    v
Ansible
```

### Work

Create:

```text
ansible/
├── ansible.cfg
├── inventory/
├── playbooks/
│   ├── setup.yml
│   └── hardening.yml
└── roles/
    ├── docker/
    ├── security/
    └── monitoring/
```

Configure:

- OS updates
- Docker
- Git
- required packages
- users
- permissions
- time synchronization
- firewall
- SSH/security baseline

### Validation gate

Run Ansible twice.

The second run should produce minimal/no changes wherever idempotency is expected.

### Day 6 Definition of Done

- [ ] Inventory works.
- [ ] Playbooks run successfully.
- [ ] Docker configured.
- [ ] Security baseline applied.
- [ ] Idempotency checked.

---

## Day 7 — Application Production Readiness

### Objective

Make the existing Node.js application suitable for container and Kubernetes deployment.

### Work

Audit:

- `package.json`
- dependencies
- scripts
- environment variables
- database path
- startup process
- logging
- errors
- API routes
- authentication
- graceful shutdown

Implement:

```text
GET /health
GET /ready
```

### Health semantics

`/health`:

> Process is alive.

`/ready`:

> Application is ready to receive traffic.

Do not make both endpoints meaningless copies of each other.

### Graceful shutdown

Implement:

```text
SIGTERM
  |
  v
Stop accepting new work
  |
  v
Finish current work
  |
  v
Close database/resources
  |
  v
Exit
```

### Validation gate

Run the application locally and verify:

- normal requests
- invalid requests
- health
- readiness
- startup
- shutdown
- SQLite read/write

### Day 7 Definition of Done

- [ ] Production environment configuration.
- [ ] Health endpoint.
- [ ] Readiness endpoint.
- [ ] Graceful shutdown.
- [ ] Logging baseline.
- [ ] SQLite path documented.

---

## Day 8 — Dockerization

### Objective

Package the application into a secure and reproducible container.

### Work

Create:

```text
Dockerfile
.dockerignore
```

Implement:

- appropriate base image
- dependency installation
- build process
- runtime stage where appropriate
- non-root user
- correct file permissions
- startup command
- healthcheck if appropriate

### Test

```bash
docker build -t app:test .
docker run --rm -p 3000:3000 app:test
```

### Validation gate

Verify:

```text
Container
   |
   v
Node.js
   |
   v
Application
   |
   v
SQLite
```

Also inspect:

```bash
docker image inspect
docker logs
docker exec
```

and verify the container does not require root.

### Day 8 Definition of Done

- [ ] Docker image builds.
- [ ] Application starts.
- [ ] Application is reachable.
- [ ] Container runs as non-root.
- [ ] Secrets are not baked into image.

---

## Day 9 — Docker Compose and Local Production Simulation

### Objective

Validate the application architecture before introducing Kubernetes.

### Work

Create/update:

```text
docker-compose.yml
```

Configure:

- application
- networking
- environment
- SQLite persistent volume
- restart behavior
- logging

### Persistence test

```text
Start application
   |
Create data
   |
Stop containers
   |
Start containers
   |
Verify data
```

### Failure test

Stop the application container and confirm restart behavior.

### Day 9 Definition of Done

- [ ] Compose starts successfully.
- [ ] Application communicates correctly.
- [ ] SQLite survives restart.
- [ ] Logs are understandable.
- [ ] Environment injection works.

---

## Day 10 — Jenkins CI Foundation

### Objective

Build the first automated CI pipeline.

### Work

Install/configure Jenkins.

Connect GitHub webhook.

Create:

```text
Jenkinsfile
```

Initial stages:

```text
Checkout
   ↓
npm ci
   ↓
Lint
   ↓
Unit Test
   ↓
Build
```

### Credentials

Configure credentials through Jenkins Credentials rather than source code.

### Validation gate

Push a harmless commit.

Expected:

```text
GitHub
   ↓
Webhook
   ↓
Jenkins
   ↓
Pipeline
   ↓
SUCCESS
```

Then intentionally break a test.

Expected:

```text
Pipeline
   ↓
FAILED
```

### Day 10 Definition of Done

- [ ] Jenkins installed.
- [ ] GitHub webhook works.
- [ ] Jenkinsfile committed.
- [ ] CI stages execute.
- [ ] Failure stops pipeline.

---

## Day 11 — DevSecOps Security Gates

### Objective

Make security part of CI rather than a manual afterthought.

### Add

```text
Gitleaks
npm audit
Trivy
```

Pipeline:

```text
Checkout
   ↓
Install
   ↓
Lint
   ↓
Tests
   ↓
Gitleaks
   ↓
npm audit
   ↓
Docker Build
   ↓
Trivy
```

### Gitleaks

Detect:

- API keys
- tokens
- passwords
- credentials
- accidental secrets

### npm audit

Review dependency vulnerabilities.

### Trivy

Scan container image.

### Validation gate

Create controlled test failures.

Confirm:

```text
Security finding
      ↓
Jenkins
      ↓
Pipeline FAILED
      ↓
No promotion
```

### Day 11 Definition of Done

- [ ] Secret scanning active.
- [ ] Dependency scanning active.
- [ ] Image scanning active.
- [ ] Security policy documented.
- [ ] Failure behavior tested.

---

## Day 12 — Container Registry and Image Versioning

### Objective

Create a reliable artifact lifecycle.

### Work

Configure a container registry.

Image tags should be traceable.

Examples:

```text
app:1.0.0
app:1.0.1
app:git-a83f21c
```

Avoid using only:

```text
latest
```

### Pipeline

```text
Git commit
   ↓
Jenkins build
   ↓
Docker image
   ↓
Trivy
   ↓
Registry
```

### Validation gate

Verify that:

```text
Git commit SHA
        ↕
Jenkins build
        ↕
Image tag
```

can be correlated.

### Day 12 Definition of Done

- [ ] Registry configured.
- [ ] Authentication secured.
- [ ] Versioned image published.
- [ ] Commit-to-image traceability documented.

---

## Day 13 — Kubernetes Foundation

### Objective

Prepare Kubernetes as the application runtime.

### Work

Create/prepare cluster.

Create namespaces:

```text
application
monitoring
logging
argocd
```

Establish:

- cluster access
- namespaces
- node readiness
- resource baseline
- storage capability

### Important SQLite decision

Do not blindly configure multiple application replicas.

SQLite remains a persistent single-database-file workload.

Initial design:

```text
Controlled application writer
       +
Persistent volume
       +
Backup/restore
```

### Validation gate

Verify:

```bash
kubectl get nodes
kubectl get namespaces
```

and confirm cluster connectivity.

### Day 13 Definition of Done

- [ ] Kubernetes cluster available.
- [ ] Namespaces created.
- [ ] Node health verified.
- [ ] Storage strategy documented.
- [ ] SQLite scaling limitation documented.

---

## Day 14 — Kubernetes Application Deployment

### Objective

Deploy the application to Kubernetes manually once before GitOps automation.

### Create

```text
k8s/
├── namespace.yaml
├── deployment.yaml
├── service.yaml
├── configmap.yaml
├── secret.yaml
├── pvc.yaml
└── ingress.yaml
```

### Deployment configuration

Implement:

- container image
- environment variables
- Secret references
- ConfigMap
- resource requests
- resource limits
- readiness probe
- liveness probe
- security context

### Storage

```text
Node.js Pod
    |
    v
SQLite
    |
    v
PVC
```

### Validation gate

Check:

```bash
kubectl get pods
kubectl get svc
kubectl get pvc
kubectl describe pod
kubectl logs
```

Verify application functionality.

### Day 14 Definition of Done

- [ ] Pod runs.
- [ ] Service works.
- [ ] PVC mounted.
- [ ] Health checks pass.
- [ ] SQLite is persistent.
- [ ] Application is reachable internally.

---

## Day 15 — Kubernetes Security and Reliability

### Objective

Harden the workload.

### Work

Implement:

- RBAC
- ServiceAccount
- SecurityContext
- non-root
- NetworkPolicy
- resource requests
- resource limits
- probes
- restricted capabilities where appropriate

### Network policy concept

```text
Ingress
   ↓
Application Service
   ↓
Application Pod

Unrelated Namespace
   X
Application Pod
```

### Failure validation

Kill the application pod.

Expected:

```text
Pod disappears
   ↓
Kubernetes notices desired-state mismatch
   ↓
Replacement pod
   ↓
Readiness passes
```

### Day 15 Definition of Done

- [ ] RBAC configured.
- [ ] Network policy tested.
- [ ] Non-root verified.
- [ ] Resource controls present.
- [ ] Self-healing tested.

---

## Day 16 — Terraform and Kubernetes Infrastructure Integration

### Objective

Remove hidden manual dependencies between AWS infrastructure and Kubernetes.

### Work

Connect:

```text
Terraform
   ↓
AWS Network
   ↓
Compute / Cluster
   ↓
Kubernetes
```

Document:

- cluster dependencies
- networking dependencies
- security group dependencies
- storage dependencies
- required outputs

### Validation gate

Destroy/recreate a non-production test component where safe and confirm the documented infrastructure process works.

### Day 16 Definition of Done

- [ ] AWS-to-Kubernetes dependencies documented.
- [ ] Terraform outputs are usable.
- [ ] No critical undocumented manual setup remains.

---

## Day 17 — Argo CD Installation

### Objective

Introduce GitOps Continuous Delivery.

### Work

Install Argo CD.

Configure:

- Argo CD namespace
- repository access
- application definition
- synchronization strategy
- access control

### Important rule

Jenkins must not run:

```bash
kubectl apply
```

for production deployment.

Instead:

```text
Jenkins
   ↓
GitOps change
   ↓
Argo CD
   ↓
Kubernetes
```

### Validation gate

Argo CD must successfully connect to the GitOps repository and Kubernetes cluster.

### Day 17 Definition of Done

- [ ] Argo CD installed.
- [ ] Git repository connected.
- [ ] Application definition created.
- [ ] Sync status visible.

---

## Day 18 — GitOps Repository and Desired State

### Objective

Move Kubernetes desired state into Git.

### Repository

```text
gitops-repo/
├── base/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── pvc.yaml
│   └── configmap.yaml
│
└── overlays/
    ├── dev/
    └── prod/
```

### Work

Define:

- application image
- environment
- replicas
- resource values
- ingress configuration
- environment-specific settings

### Validation gate

Change only the image version in Git.

Expected:

```text
Git change
   ↓
Argo CD detects drift
   ↓
Sync
   ↓
New pod
```

### Day 18 Definition of Done

- [ ] GitOps repo created.
- [ ] Desired state stored in Git.
- [ ] Argo CD watches repository.
- [ ] Git change causes deployment.

---

## Day 19 — Complete CI/CD Integration

### Objective

Connect the complete software delivery chain.

### Final pipeline

```text
Developer
   ↓
GitHub
   ↓
Jenkins
   ↓
Tests
   ↓
Gitleaks
   ↓
npm audit
   ↓
Docker Build
   ↓
Trivy
   ↓
Registry
   ↓
GitOps update
   ↓
Argo CD
   ↓
Kubernetes
```

### Work

Automate the transition from successful CI to a GitOps image update.

### Important design

Jenkins changes the desired image version in GitOps.

Argo CD performs the deployment.

### Validation gate

Make one real application change.

Trace:

```text
Commit SHA
→ Jenkins build
→ Image
→ GitOps commit
→ Argo CD sync
→ Kubernetes pod
→ User-visible change
```

### Day 19 Definition of Done

- [ ] End-to-end CI/CD works.
- [ ] Jenkins does not directly deploy.
- [ ] Argo CD performs deployment.
- [ ] Deployment is traceable to Git commit.

---

## Day 20 — Rollout, Failure and Rollback

### Objective

Prove that deployment recovery works.

### Work

Deploy:

```text
Version 1.0.0
```

Then:

```text
Version 1.0.1
```

Introduce a controlled failure.

Observe:

- rollout status
- pod readiness
- logs
- Argo CD status

### Rollback

Use Git:

```text
Current GitOps commit
        ↓
Git revert
        ↓
Argo CD
        ↓
Previous version
```

### Validation gate

The old application version must become healthy again.

### Day 20 Definition of Done

- [ ] Rollout tested.
- [ ] Failure tested.
- [ ] GitOps rollback tested.
- [ ] Recovery documented.
- [ ] Evidence captured.

---

## Day 21 — Ingress and External Networking

### Objective

Create the controlled path from the internet to the private application.

### Target flow

```text
Internet
   ↓
AWS public entry
   ↓
Ingress / Nginx
   ↓
Kubernetes Service
   ↓
Node.js Pod
```

### Work

Configure:

- public entry
- ingress
- host/path routing
- service routing
- internal application access

### Security goal

The Node.js application should not require a public IP.

### Validation gate

Verify:

```text
Public URL → application
Direct pod access → not public
Direct Node.js port → not public
```

### Day 21 Definition of Done

- [ ] Ingress works.
- [ ] Application is externally reachable through intended path.
- [ ] Direct application exposure is blocked.
- [ ] Routing documented.

---

## Day 22 — HTTPS and Application Security

### Objective

Secure public traffic.

### Work

Implement:

- TLS
- HTTPS
- HTTP to HTTPS redirect
- security headers
- domain configuration if available
- certificate lifecycle documentation

### Traffic

```text
HTTP
  |
  v
Redirect
  |
  v
HTTPS
  |
  v
Ingress
  |
  v
Application
```

### Validation gate

Check:

- valid HTTPS
- HTTP redirect
- application routes
- security headers
- certificate validity

### Day 22 Definition of Done

- [ ] HTTPS works.
- [ ] HTTP redirects.
- [ ] Certificate strategy documented.
- [ ] Public security baseline validated.

---

## Day 23 — Prometheus Monitoring

### Objective

Make the platform observable through metrics.

### Work

Install/configure:

```text
Prometheus
```

Collect:

- CPU
- memory
- pod count
- pod restarts
- request metrics
- error metrics
- latency where available
- Kubernetes health

### Validation gate

Generate application traffic and verify metrics change.

Kill/restart a pod and verify restart-related metrics.

### Day 23 Definition of Done

- [ ] Prometheus running.
- [ ] Kubernetes metrics visible.
- [ ] Application metrics available where supported.
- [ ] Key metrics documented.

---

## Day 24 — Grafana Dashboards and Alerting

### Objective

Turn metrics into operational visibility.

### Dashboards

Create:

```text
Kubernetes Overview
Application Overview
Resource Usage
Request/Error Overview
```

### Alerts

Start with actionable alerts:

```text
Application unavailable
High error rate
Repeated pod restart
High CPU
High memory
```

### Validation gate

Trigger a controlled condition.

Expected:

```text
Condition
   ↓
Metric
   ↓
Alert rule
   ↓
Alert
```

### Day 24 Definition of Done

- [ ] Grafana configured.
- [ ] Dashboards created.
- [ ] Alerts configured.
- [ ] At least one alert tested.

---

## Day 25 — Loki Centralized Logging

### Objective

Make application logs searchable from one place.

### Work

Configure:

```text
Application
   ↓
Container Logs
   ↓
Loki
   ↓
Grafana
```

Capture useful information:

- startup
- shutdown
- HTTP errors
- application exceptions
- database errors
- authentication failures where relevant

### Validation gate

Generate a controlled application error.

Find the same event in Loki/Grafana.

### Day 25 Definition of Done

- [ ] Loki running.
- [ ] Logs collected.
- [ ] Grafana can query logs.
- [ ] Application error searchable.

---

## Day 26 — SQLite Backup and Restore

### Objective

Protect the application's persistent data.

### Work

Create backup mechanism.

Define:

- backup schedule
- naming
- retention
- storage location
- permissions
- restore process
- integrity verification

### Test

```text
Create data
   ↓
Backup
   ↓
Simulate database loss
   ↓
Restore
   ↓
SQLite integrity check
   ↓
Application startup
   ↓
Data verification
```

### Important

A backup is not considered successful merely because a file exists.

The restore must be tested.

### Day 26 Definition of Done

- [ ] Automated/repeatable backup.
- [ ] Retention documented.
- [ ] Restore procedure written.
- [ ] Restore successfully tested.

---

## Day 27 — Full DevSecOps Hardening Review

### Objective

Perform a security review across the complete stack.

### AWS review

- IAM
- MFA
- public exposure
- security groups
- private subnets
- access paths

### Git review

- secrets
- repository permissions
- branch controls
- Gitleaks

### Docker review

- non-root
- vulnerable packages
- minimal image
- no secrets

### Kubernetes review

- RBAC
- ServiceAccounts
- Secrets
- NetworkPolicies
- SecurityContext
- resource limits

### Jenkins review

- credentials
- permissions
- build logs
- agent security
- registry credentials

### Validation gate

Create a final security findings list:

```text
Finding
Severity
Impact
Fix
Status
```

### Day 27 Definition of Done

- [ ] Security checklist complete.
- [ ] Findings fixed or explicitly documented.
- [ ] No known accidental secrets.
- [ ] Public attack surface reviewed.

---

## Day 28 — Failure Testing and Recovery Engineering

### Objective

Intentionally break the system and prove that recovery works.

### Test 1 — Pod failure

```text
Kill pod
→ Kubernetes replaces pod
→ Readiness passes
→ Traffic returns
```

### Test 2 — Readiness failure

```text
Application unhealthy
→ Readiness fails
→ Service removes traffic
```

### Test 3 — Bad deployment

```text
Bad image/config
→ Deployment failure
→ GitOps revert
→ Argo CD sync
→ Previous version
```

### Test 4 — Database recovery

```text
Database loss simulation
→ Restore backup
→ Integrity check
→ Application validation
```

### Test 5 — CI security failure

```text
Controlled secret/vulnerability test
→ Scanner detects
→ Jenkins fails
→ No promotion
```

### Evidence

For every test record:

```text
Scenario
Expected result
Observed result
Logs/metrics
Recovery action
Final status
```

### Day 28 Definition of Done

- [ ] Failure tests executed.
- [ ] Recovery verified.
- [ ] Evidence captured.
- [ ] Runbooks updated.

---

## Day 29 — End-to-End Production Validation

### Objective

Validate the platform as a complete system rather than individual components.

### Primary test

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

### Validate operations

```text
Metrics
Logs
Alerts
Backup
Restore
Rollback
HTTPS
Health
Readiness
```

### Traceability test

Given a running image:

```text
Image
  ↓
Git commit
  ↓
Jenkins build
  ↓
GitOps commit
  ↓
Argo CD sync
  ↓
Kubernetes deployment
```

An engineer should be able to trace the complete chain.

### Day 29 Definition of Done

- [ ] End-to-end deployment works.
- [ ] Observability works.
- [ ] Security works.
- [ ] Rollback works.
- [ ] Backup/restore works.
- [ ] Traceability works.

---

## Day 30 — Production Review, Documentation and Handover

### Objective

Turn the implementation into a professional engineering project that another DevOps engineer can operate.

### Documentation

Complete:

```text
docs/
├── architecture.md
├── requirements.md
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

### Architecture explanation

The final documentation must explain:

```text
Why AWS?
Why VPC?
Why public/private subnets?
Why Terraform?
Why Ansible?
Why Docker?
Why Jenkins?
Why Argo CD?
Why GitOps?
Why Kubernetes?
Why Nginx/Ingress?
Why Prometheus?
Why Grafana?
Why Loki?
Why SQLite?
Why backup/restore?
```

### Final operational review

An engineer joining the project should be able to:

1. Understand the architecture.
2. Understand the repositories.
3. Recreate infrastructure.
4. Run the CI pipeline.
5. Understand the deployment process.
6. Diagnose a failed pod.
7. Diagnose a failed deployment.
8. Inspect metrics.
9. Search logs.
10. Roll back a release.
11. Restore SQLite.
12. Understand security controls.

### Day 30 Definition of Done

- [ ] All project documentation complete.
- [ ] Architecture diagram finalized.
- [ ] Runbooks finalized.
- [ ] Production validation checklist passed.
- [ ] Failure evidence stored.
- [ ] Final Git repositories clean.
- [ ] Project can be demonstrated end-to-end.

---

## 30-Day Daily Output Summary

| Day | Primary Work | Main Output |
|---|---|---|
| 1 | Discovery + architecture + AWS foundation | Architecture + requirements |
| 2 | Terraform + VPC | AWS VPC through IaC |
| 3 | Routing + security groups | Network security boundary |
| 4 | Terraform structure | Reusable IaC |
| 5 | IAM | Least-privilege access |
| 6 | Ansible | Configured Linux infrastructure |
| 7 | Application hardening | Production-ready Node.js |
| 8 | Docker | Production container |
| 9 | Compose | Local production simulation |
| 10 | Jenkins | Basic CI |
| 11 | DevSecOps | Security gates |
| 12 | Registry | Versioned images |
| 13 | Kubernetes foundation | Cluster + namespaces |
| 14 | Kubernetes app | Running application |
| 15 | K8s security | Hardened workload |
| 16 | Infrastructure integration | AWS/K8s integration |
| 17 | Argo CD | GitOps CD foundation |
| 18 | GitOps repo | Desired state |
| 19 | CI/CD integration | Full automated workflow |
| 20 | Rollback | Recovery from bad release |
| 21 | Ingress | External application routing |
| 22 | HTTPS | Secure public traffic |
| 23 | Prometheus | Metrics |
| 24 | Grafana | Dashboards + alerts |
| 25 | Loki | Centralized logs |
| 26 | Backup | SQLite backup/restore |
| 27 | Security review | DevSecOps hardening |
| 28 | Failure testing | Reliability evidence |
| 29 | E2E validation | Complete system validation |
| 30 | Documentation | Production handover |

---

## 30-Day Dependency Flow

The order matters:

```text
DAY 1
Architecture
   |
DAY 2-5
AWS + Terraform + IAM
   |
DAY 6
Ansible
   |
DAY 7
Application readiness
   |
DAY 8-9
Docker
   |
DAY 10-12
Jenkins + Security + Registry
   |
DAY 13-16
Kubernetes
   |
DAY 17-20
Argo CD + GitOps + Rollback
   |
DAY 21-22
Ingress + HTTPS
   |
DAY 23-25
Monitoring + Logging
   |
DAY 26
Backup/Restore
   |
DAY 27-28
Security + Failure Testing
   |
DAY 29
End-to-End Validation
   |
DAY 30
Production Documentation
```

The implementation therefore moves from:

```text
Understand
   ↓
Design
   ↓
Provision
   ↓
Configure
   ↓
Containerize
   ↓
Validate
   ↓
Secure
   ↓
Orchestrate
   ↓
GitOps Deploy
   ↓
Expose
   ↓
Observe
   ↓
Recover
   ↓
Validate
   ↓
Document
```

This sequence is the actual execution plan for the project.

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

# 23. Junior Engineer Execution Runbook

This section is intentionally operational. A junior engineer should be able to use it to answer four questions at every stage:

1. What must I install?
2. What command should I run?
3. How do I verify that the tool is working?
4. What should I do if the command fails?

The commands below assume macOS for the developer workstation and Linux/Ubuntu for AWS hosts unless a section explicitly says otherwise.

---

## 23.1 Golden Rules Before Running Commands

- Read the current day's objective before changing anything.
- Never run an unknown destructive command against production.
- Run `--version`, `validate`, `plan`, `diff`, or an equivalent dry-run command before applying a large change whenever possible.
- Keep AWS credentials out of Git.
- Keep application secrets out of Dockerfiles and Kubernetes manifests.
- Never commit `.env`, private keys, AWS access keys, Jenkins secrets, kubeconfig files, or database backups containing sensitive data.
- Prefer a non-root shell when possible, and use `sudo` only when required.
- Copy commands exactly first; modify paths, names, and values only when the plan explicitly tells you to.
- If a command fails, read the last 10-30 lines of the error before retrying.
- Do not repeatedly retry a failed command without identifying the cause.
- Record important errors and their solutions in `docs/troubleshooting.md`.
- For infrastructure changes, run Terraform `fmt`, `validate`, and `plan` before `apply`.
- For Kubernetes changes, inspect the manifest and run `kubectl apply --dry-run=client` where appropriate before applying.
- Jenkins is CI only in this project.
- Jenkins must not become a second CD system by running `kubectl apply`.
- Argo CD is the deployment authority for Kubernetes.
- Git is the source of truth for application source and GitOps desired state.
- SQLite must remain persistent and must not be treated as disposable container filesystem data.

---

# 24. Workstation Tool Installation Matrix

The following table is the first reference a junior engineer should use.

| Tool | Why we need it | Install on macOS | Verify | Primary project days |
|---|---|---|---|---|
| Homebrew | macOS package manager | Official Homebrew installer | `brew --version` | Day 1 onward |
| Git | Source control | `brew install git` | `git --version` | Day 1 onward |
| GitHub CLI | GitHub authentication and repository operations | `brew install gh` | `gh --version` | Day 1, 10, 18, 19 |
| Node.js | Build/test the Node.js application | `brew install node` | `node --version` | Day 7-12 |
| npm | Node package manager | Included with Node.js | `npm --version` | Day 7-12 |
| Docker | Container build and local runtime | Docker Desktop | `docker --version` | Day 8-12 |
| Docker Compose | Multi-container local testing | Included with Docker Desktop | `docker compose version` | Day 9 |
| Terraform | Infrastructure as Code | `brew install terraform` | `terraform version` | Day 2-5, 16 |
| Ansible | Linux configuration management | `brew install ansible` | `ansible --version` | Day 6 |
| kubectl | Kubernetes CLI | `brew install kubectl` | `kubectl version --client` | Day 13 onward |
| Helm | Kubernetes package manager | `brew install helm` | `helm version` | Day 17, 23-25 |
| Minikube | Local Kubernetes learning/testing | `brew install minikube` | `minikube version` | Day 13-20 if used |
| Kind | Alternative local Kubernetes | `brew install kind` | `kind version` | Optional |
| Trivy | Container/dependency security scanning | `brew install trivy` | `trivy --version` | Day 11 onward |
| Gitleaks | Secret scanning | `brew install gitleaks` | `gitleaks version` | Day 11 onward |
| jq | JSON inspection | `brew install jq` | `jq --version` | Day 1 onward |
| yq | YAML inspection/editing | `brew install yq` | `yq --version` | Day 18 onward |
| wget | Download utility | `brew install wget` | `wget --version` | Optional |
| curl | HTTP/API testing | Usually preinstalled | `curl --version` | Day 7 onward |
| Postman | API testing | Postman desktop app | Open Postman | Day 7, 29 |
| AWS CLI | AWS resource operations | `brew install awscli` | `aws --version` | Day 1 onward |
| OpenSSL | TLS/certificate troubleshooting | `brew install openssl` if needed | `openssl version` | Day 22 |

Important: Jenkins, Argo CD, Prometheus, Grafana, Loki, Nginx/Ingress, and Kubernetes server components are not normally installed on the laptop as standalone desktop applications for this project. They are deployed into their intended runtime environments.

---

# 25. macOS Bootstrap Installation

## 25.1 Check the Operating System

Run:

```bash
sw_vers
uname -m
```

Expected architecture for an Apple Silicon Mac is commonly:

```text
arm64
```

If the machine reports `x86_64`, use the correct package architecture for that machine.

### Common error

```text
command not found: sw_vers
```

This would be unusual on macOS. Confirm that the terminal is actually running macOS and not a restricted shell.

---

## 25.2 Install Homebrew

Check first:

```bash
brew --version
```

If the result is:

```text
zsh: command not found: brew
```

install Homebrew using the official installer from the Homebrew website.

After installation, Homebrew may instruct you to add its shell environment to `~/.zprofile`. Follow the exact command printed by the installer.

Then restart Terminal or run the printed shell initialization command.

Verify:

```bash
brew --version
which brew
```

### Common error: Homebrew installed but command not found

Run:

```bash
which brew
```

If nothing is returned, inspect the common Apple Silicon location:

```bash
ls -la /opt/homebrew/bin/brew
```

If it exists, add Homebrew to the shell environment:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Then:

```bash
brew --version
```

Do not permanently edit random PATH values if the Homebrew installer has already provided the correct shellenv command.

---

## 25.3 Install the Core CLI Tools

Run:

```bash
brew update
brew install git gh node terraform ansible kubectl helm trivy gitleaks jq yq awscli
```

If one package fails, do not assume every package failed. Verify each important command separately.

Run:

```bash
git --version
gh --version
node --version
npm --version
terraform version
ansible --version
kubectl version --client
helm version
trivy --version
gitleaks version
jq --version
yq --version
aws --version
```

### If `brew update` fails

First run:

```bash
brew doctor
```

Then inspect the specific warning. Do not blindly delete Homebrew directories.

### If a package says it is already installed

Use:

```bash
brew list <package-name>
```

Then verify the binary:

```bash
which <command>
```

---

# 26. Node.js and npm Troubleshooting

## 26.1 Verify Node.js

```bash
node --version
npm --version
```

The project README should be treated as the source of truth for the application's supported Node.js version.

### Error: `node: command not found`

Install Node.js:

```bash
brew install node
```

Then restart Terminal if required.

### Error: npm permission problems

Do not immediately run the entire project with `sudo npm install`.

First check:

```bash
npm config get prefix
npm config get cache
```

The goal is to use a user-controlled Node/npm installation rather than repeatedly creating root-owned project files.

### Error: dependency installation fails

Run:

```bash
node --version
npm --version
npm cache verify
```

Then remove only the project's generated dependency directory if appropriate:

```bash
rm -rf node_modules
```

Use the repository's lock file and preferred command. If `package-lock.json` exists, prefer:

```bash
npm ci
```

instead of inventing a different dependency installation process.

---

# 27. Git and GitHub CLI Setup

## 27.1 Verify Git

```bash
git --version
```

Configure identity:

```bash
git config --global user.name "YOUR_NAME"
git config --global user.email "YOUR_EMAIL"
```

Verify:

```bash
git config --global --list
```

## 27.2 Authenticate GitHub CLI

```bash
gh auth login
```

Verify:

```bash
gh auth status
```

### Common error: `gh: command not found`

```bash
brew install gh
```

### Common error: Git push rejected

First inspect:

```bash
git status
git branch --show-current
git remote -v
git log --oneline -5
```

Do not immediately force push.

If the remote contains commits not present locally, understand the divergence first:

```bash
git fetch origin
git log --oneline --graph --decorate --all -20
```

Use force push only when the repository workflow explicitly permits rewriting the remote branch and the consequences are understood.

---

# 28. AWS CLI Setup

## 28.1 Install and Verify

```bash
brew install awscli
aws --version
```

Configure credentials only through the approved AWS authentication method for the project.

For a learning account using access keys, the basic command is:

```bash
aws configure
```

Verify identity:

```bash
aws sts get-caller-identity
```

This is the most important first AWS verification command.

### Common error: `Unable to locate credentials`

Check:

```bash
aws configure list
```

Then authenticate using the approved method.

Do not paste access keys into source files, `.env` files committed to Git, Dockerfiles, Jenkinsfiles, or Kubernetes manifests.

### Common error: `ExpiredToken`

The current AWS authentication session has expired. Re-authenticate using the configured organization-approved method.

### Common error: `AccessDenied`

Do not bypass the error by granting `AdministratorAccess` automatically. Identify the exact API action and resource that was denied and fix the least-privilege IAM policy.

---

# 29. Docker Installation and Troubleshooting

## 29.1 Install Docker Desktop on macOS

Install Docker Desktop using the official Docker distribution appropriate for Apple Silicon.

Then open Docker Desktop and wait until the engine reports that it is running.

Verify:

```bash
docker --version
docker compose version
docker info
```

Test:

```bash
docker run --rm hello-world
```

### Error: `Cannot connect to the Docker daemon`

Docker Desktop is not running or the Docker engine is unavailable.

Action:

1. Open Docker Desktop.
2. Wait for the engine to become ready.
3. Run:

```bash
docker info
```

again.

### Error: `docker: command not found`

Restart Terminal after Docker Desktop installation and verify:

```bash
which docker
docker --version
```

### Error: port already allocated

Find the process using the port:

```bash
lsof -nP -iTCP:<PORT> -sTCP:LISTEN
```

Then either stop the conflicting process or change the local development port according to the project configuration.

---

# 30. Terraform Installation and Safe Workflow

## 30.1 Verify

```bash
terraform version
```

## 30.2 Standard Terraform Workflow

Always use this order:

```bash
terraform fmt -recursive
terraform init
terraform validate
terraform plan
```

Only after reviewing the plan:

```bash
terraform apply
```

For automation, prefer a saved plan where appropriate:

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

## 30.3 Common Terraform Errors

### Error: `terraform: command not found`

```bash
brew install terraform
```

### Error: provider initialization failure

Run:

```bash
terraform init -upgrade
```

Use `-upgrade` intentionally; it can change provider versions and therefore should be reviewed in a controlled project.

### Error: state lock

Do not delete lock state blindly. Determine whether another Terraform process is running.

### Error: AWS credentials not found

Verify:

```bash
aws sts get-caller-identity
```

Then retry Terraform.

### Error: resource already exists

Do not recreate resources blindly. Determine whether the resource was created manually or by another Terraform state.

If appropriate, import the existing resource into Terraform state using the correct resource address and provider-supported ID.

---

# 31. Ansible Installation and Safe Workflow

## 31.1 Verify

```bash
ansible --version
```

## 31.2 Test Connectivity

For an inventory containing an approved test host:

```bash
ansible all -i inventory.ini -m ping
```

Expected result includes:

```text
pong
```

## 31.3 Common Ansible Errors

### Error: `No hosts matched`

Check:

```bash
cat inventory.ini
```

Verify group names match the playbook target.

### Error: SSH permission denied

Verify the approved SSH key, username, security group, and host address. If AWS Systems Manager is the project's selected access path, use SSM rather than introducing an unnecessary public SSH path.

### Error: Python interpreter not found

Verify Python on the target host:

```bash
python3 --version
```

Set the correct Ansible interpreter only when necessary.

### Idempotency check

Run the same playbook twice. The second run should normally report fewer or no changes.

---

# 32. Kubernetes CLI Installation and Local Validation

## 32.1 Verify kubectl

```bash
kubectl version --client
```

Check context:

```bash
kubectl config get-contexts
kubectl config current-context
```

Never run a production command until the current context is verified.

A useful safety command is:

```bash
kubectl cluster-info
```

## 32.2 Local Minikube Option

If the project uses Minikube for local Kubernetes learning/testing:

```bash
brew install minikube
minikube version
minikube start
kubectl get nodes
```

Expected node status should become `Ready`.

### Common error: driver unavailable

Inspect:

```bash
minikube status
```

Choose an installed supported driver instead of randomly changing settings.

### Common error: Kubernetes context points to the wrong cluster

Run:

```bash
kubectl config get-contexts
kubectl config current-context
```

Switch deliberately:

```bash
kubectl config use-context <EXPECTED_CONTEXT>
```

---

# 33. Helm Installation and Troubleshooting

Verify:

```bash
helm version
```

Inspect repositories:

```bash
helm repo list
```

Update repositories when required:

```bash
helm repo update
```

### Error: chart not found

Verify the repository exists and that the chart name is correct:

```bash
helm repo list
helm search repo <keyword>
```

Do not copy an old chart URL from an outdated tutorial without checking the current project documentation.

---

# 34. Security Tool Installation and Verification

## 34.1 Gitleaks

Install:

```bash
brew install gitleaks
```

Verify:

```bash
gitleaks version
```

Run against the repository:

```bash
gitleaks detect --source . --redact
```

If a secret is found:

1. Stop the deployment workflow.
2. Determine whether the secret is real.
3. Revoke/rotate it if exposed.
4. Remove it from source.
5. Review Git history when required.
6. Store the replacement secret in the approved secret-management mechanism.

Do not merely add a false-positive allowlist entry to make the pipeline green.

## 34.2 npm audit

Run:

```bash
npm audit
```

For CI visibility:

```bash
npm audit --audit-level=high
```

The exact severity threshold should be documented in the project security policy.

## 34.3 Trivy

Install:

```bash
brew install trivy
```

Verify:

```bash
trivy --version
```

Scan an image:

```bash
trivy image <IMAGE>:<TAG>
```

If the scan fails because the image is unavailable, verify the image name and local registry authentication before changing the security policy.

---

# 35. Application Validation Commands

Before containerization, verify the Node.js application locally.

Typical sequence:

```bash
npm ci
npm run lint
npm test
npm run build
npm start
```

Use only scripts that actually exist in `package.json`.

Inspect available scripts:

```bash
npm run
```

If `npm run lint` fails because the script does not exist, do not invent a fake script. Document the gap and decide whether linting must be added.

## Health endpoint test

If the application exposes `/health`:

```bash
curl -i http://localhost:<PORT>/health
```

If `/ready` exists:

```bash
curl -i http://localhost:<PORT>/ready
```

A health endpoint should answer whether the process is alive. Readiness should answer whether the application is ready to receive traffic and its required dependencies are available.

---

# 36. Dockerfile Junior Checklist

Before building the image, confirm:

- A supported Node.js base image is used.
- The image does not contain AWS credentials.
- `.dockerignore` excludes `node_modules`, Git metadata, local environment files, logs, and unnecessary development artifacts.
- The runtime does not need root privileges.
- Only required files are copied into the runtime image.
- The application listens on the expected port.
- The image has a predictable startup command.
- SQLite is mounted on persistent storage rather than relying on the container writable layer.

Build:

```bash
docker build -t healthcare-app:local .
```

Run:

```bash
docker run --rm -p 3000:3000 healthcare-app:local
```

Test:

```bash
curl -i http://localhost:3000/health
```

### Error: container exits immediately

Run:

```bash
docker ps -a
docker logs <CONTAINER_ID>
```

Do not guess. The logs normally identify the startup failure.

### Error: application cannot find SQLite database

Check the mounted path and application environment variables. Confirm the application has permission to read/write the database directory.

---

# 37. Docker Compose Junior Workflow

Validate the Compose file before starting where supported:

```bash
docker compose config
```

Start:

```bash
docker compose up -d --build
```

Inspect:

```bash
docker compose ps
docker compose logs --tail=100
```

Test:

```bash
curl -i http://localhost:<PORT>/health
```

Stop:

```bash
docker compose down
```

If persistence is being tested, understand the difference between:

```bash
docker compose down
```

and destructive volume removal such as:

```bash
docker compose down -v
```

Never use `-v` during a database persistence test unless deletion is intentional.

---

# 38. Jenkins Installation and Troubleshooting

Jenkins is a server-side CI system. The laptop does not need to run Jenkins permanently.

Recommended learning approach:

1. Run Jenkins in an approved development environment.
2. Configure credentials through Jenkins Credentials.
3. Connect the application repository.
4. Use the repository `Jenkinsfile`.
5. Validate the pipeline with a harmless commit.

Do not put credentials directly in the `Jenkinsfile`.

## Pipeline stages

The baseline CI flow is:

```text
Checkout
  -> npm ci
  -> lint
  -> unit tests
  -> build
  -> Gitleaks
  -> npm audit
  -> Docker build
  -> Trivy scan
  -> image push
```

Jenkins stops at CI. Kubernetes deployment is performed by Argo CD through GitOps.

### Common Jenkins error: agent has no Docker access

Check:

```bash
docker info
```

on the Jenkins execution environment.

The fix depends on how Jenkins is deployed. Do not automatically mount the host Docker socket in a production environment without reviewing the security implications.

### Common Jenkins error: Node/npm not found

Verify the selected Jenkins agent image or tool installation. The CI environment must explicitly contain the required Node.js version.

### Common Jenkins error: Git authentication failure

Verify the Jenkins credential and repository URL. Do not paste a personal token into the Jenkinsfile.

---

# 39. Container Registry Workflow

Every deployable image must have a traceable version.

Preferred examples:

```text
app:1.0.0
app:git-a83f21c
```

Avoid using only:

```text
app:latest
```

because it hides deployment traceability.

Before pushing an image, verify:

```bash
docker images
```

Scan:

```bash
trivy image <IMAGE>:<TAG>
```

Push only after CI security gates pass.

---

# 40. Kubernetes Application Deployment Runbook

Before applying a manifest:

```bash
kubectl config current-context
kubectl get nodes
kubectl get namespaces
```

Inspect YAML:

```bash
cat k8s/<manifest>.yaml
```

Dry-run when supported:

```bash
kubectl apply --dry-run=client -f k8s/<manifest>.yaml
```

Apply through the GitOps workflow in the production architecture. Direct manual `kubectl apply` is for controlled local/debug scenarios and must not replace Argo CD as production CD.

Inspect:

```bash
kubectl get pods -A
kubectl get svc -A
kubectl get ingress -A
```

Describe a failing pod:

```bash
kubectl describe pod <POD> -n <NAMESPACE>
```

Logs:

```bash
kubectl logs <POD> -n <NAMESPACE>
```

Previous container logs after a restart:

```bash
kubectl logs <POD> -n <NAMESPACE> --previous
```

---

# 41. Kubernetes Failure Decision Tree

When a pod is not running, follow this order.

### Case A: `Pending`

Run:

```bash
kubectl describe pod <POD> -n <NAMESPACE>
```

Look for:

- insufficient CPU/memory
- unsatisfied PVC
- node selector mismatch
- taints/tolerations
- scheduling constraints

### Case B: `CrashLoopBackOff`

Run:

```bash
kubectl logs <POD> -n <NAMESPACE>
kubectl logs <POD> -n <NAMESPACE> --previous
```

Check application startup, environment variables, database path, permissions, and configuration.

### Case C: `ImagePullBackOff`

Run:

```bash
kubectl describe pod <POD> -n <NAMESPACE>
```

Check image name, tag, registry authentication, and whether the image actually exists.

### Case D: `Running` but not `Ready`

Inspect readiness failures:

```bash
kubectl describe pod <POD> -n <NAMESPACE>
```

Check the readiness endpoint directly inside the application environment where appropriate.

### Case E: service returns 503

Check in this order:

```bash
kubectl get pods -n <NAMESPACE>
kubectl get svc -n <NAMESPACE>
kubectl get endpoints -n <NAMESPACE>
```

A service without healthy endpoints usually means the selector or readiness state is wrong.

---

# 42. SQLite Persistence Runbook

SQLite is a file-based database. Kubernetes must not treat its database file as temporary container storage.

The project therefore uses:

```text
Node.js application
        |
        v
Persistent Volume
        |
        v
SQLite database file
```

Because SQLite is a single-writer database, the project must enforce a controlled application topology rather than casually scaling application replicas horizontally.

Before deployment, identify:

- SQLite file path
- parent directory
- filesystem permissions
- PVC mount path
- backup source path
- restore destination
- database integrity check command

Example integrity check:

```bash
sqlite3 <database-file> "PRAGMA integrity_check;"
```

Expected healthy output is normally:

```text
ok
```

If `sqlite3` is not installed locally on macOS:

```bash
brew install sqlite
```

Verify:

```bash
sqlite3 --version
```

---

# 43. SQLite Backup and Restore Runbook

A backup is not considered successful until a restore has been tested.

Basic conceptual workflow:

```text
Application data
      |
      v
Consistent backup
      |
      v
Protected backup storage
      |
      v
Restore to isolated location
      |
      v
Integrity check
      |
      v
Application validation
```

Before backup:

```bash
sqlite3 <database-file> "PRAGMA wal_checkpoint(FULL);"
```

Use the application's approved backup procedure if it has one.

After restore:

```bash
sqlite3 <restored-database> "PRAGMA integrity_check;"
```

Do not overwrite the live production database during the first restore test. Restore into an isolated test location first.

---

# 44. Argo CD Runbook

Argo CD is the CD authority.

The expected flow is:

```text
GitOps Repository
      |
      v
Argo CD
      |
      v
Kubernetes
```

Jenkins may update the GitOps desired image version according to the approved workflow, but Jenkins must not deploy directly with `kubectl apply`.

Inspect Argo applications:

```bash
argocd app list
```

If the `argocd` CLI is installed locally, verify it with:

```bash
argocd version --client
```

If not installed and needed:

```bash
brew install argocd
```

### Application is `OutOfSync`

First determine whether the drift is intentional.

Inspect the application:

```bash
argocd app get <APP_NAME>
```

Do not blindly click Sync until the desired Git state has been checked.

### Application is `Degraded`

Inspect the failing Kubernetes resource. Argo CD reports deployment state, but the root cause is often visible through Kubernetes:

```bash
kubectl get pods -n <NAMESPACE>
kubectl describe pod <POD> -n <NAMESPACE>
kubectl logs <POD> -n <NAMESPACE>
```

---

# 45. Nginx / Ingress Troubleshooting

Traffic model:

```text
Internet
   |
   v
AWS public entry point
   |
   v
Ingress / Nginx
   |
   v
Kubernetes Service
   |
   v
Node.js Pod
```

If the application is unreachable:

1. Check DNS.
2. Check public load balancer/entry point.
3. Check Ingress.
4. Check Service.
5. Check endpoints.
6. Check Pod readiness.
7. Check application logs.

Commands:

```bash
kubectl get ingress -A
kubectl describe ingress <INGRESS> -n <NAMESPACE>
kubectl get svc -n <NAMESPACE>
kubectl get endpoints -n <NAMESPACE>
```

Do not expose the application Pod directly to the Internet just to bypass an Ingress problem.

---

# 46. HTTPS Troubleshooting

Validate the endpoint:

```bash
curl -I https://<DOMAIN>
```

For TLS debugging:

```bash
openssl s_client -connect <DOMAIN>:443 -servername <DOMAIN>
```

Check:

- certificate hostname
- certificate expiry
- TLS termination point
- HTTP-to-HTTPS redirect
- security group/load balancer access
- Ingress configuration
- DNS record

### Error: certificate mismatch

The certificate does not cover the hostname being requested. Use a certificate whose SANs include the actual domain.

### Error: HTTPS works but HTTP does not redirect

Inspect the load balancer/Ingress HTTP listener and redirect configuration.

---

# 47. Prometheus Troubleshooting

Prometheus is responsible for metrics collection, not application log storage.

Check pods:

```bash
kubectl get pods -n monitoring
```

Check services:

```bash
kubectl get svc -n monitoring
```

If a target is missing, inspect the Prometheus target configuration and Kubernetes service discovery.

Questions to answer:

- Is Prometheus running?
- Is the target discovered?
- Is the target endpoint reachable?
- Is the metrics endpoint returning valid metrics?
- Are scrape errors visible?

Do not solve a missing metric by inventing a dashboard panel. First fix metric collection.

---

# 48. Grafana Troubleshooting

Grafana is primarily the visualization and dashboard layer.

If a dashboard shows `No data`:

1. Verify Prometheus has data.
2. Verify Grafana's data source.
3. Verify the dashboard query.
4. Verify the selected time range.
5. Verify metric labels.

For Loki dashboards:

1. Verify Loki is healthy.
2. Verify the log collector is healthy.
3. Verify logs are arriving.
4. Verify Grafana's Loki data source.
5. Verify the LogQL query.

Do not assume an empty dashboard means the application is healthy.

---

# 49. Loki Logging Troubleshooting

Expected flow:

```text
Application stdout/stderr
          |
          v
Container runtime / log collector
          |
          v
Loki
          |
          v
Grafana
```

First check application logs directly:

```bash
kubectl logs <POD> -n <NAMESPACE>
```

If logs exist there but not in Grafana, investigate the collector/Loki path.

If logs do not exist there, fix application/container logging first.

Application logs should contain useful operational information such as:

- startup
- shutdown
- request failures
- authentication failures
- database failures
- dependency failures
- important background job failures

Do not log passwords, access tokens, API keys, or sensitive personal information.

---

# 50. AWS Network Troubleshooting

Use this traffic model before changing security groups:

```text
Internet
   |
   v
Public Subnet
   |
   v
Internet-facing load balancer
   |
   v
Private Subnet
   |
   v
Kubernetes worker/application workload
```

For every blocked request ask:

1. Is the route correct?
2. Is the subnet correct?
3. Is the security group correct?
4. Is NetworkPolicy blocking the request?
5. Is the Kubernetes Service correct?
6. Is the Pod ready?
7. Is the application listening on the expected port?

### Error: private workload cannot reach the Internet

Check whether the architecture intentionally requires outbound access.

Then inspect:

- private route table
- NAT decision
- security group egress
- DNS resolution
- network ACLs if used

Do not add a public IP to a private workload merely to make outbound access work.

### NAT Gateway cost warning

AWS NAT Gateway is a billable service. Because this project emphasizes cost awareness, document the selected outbound design and its expected cost before enabling it.

---

# 51. AWS Security Group Troubleshooting

Security groups should reflect required traffic rather than broad convenience access.

Bad example:

```text
0.0.0.0/0 -> all ports
```

Preferred model:

```text
Internet -> public entry point -> required application port
Public entry point -> private application port
Admin access -> approved management path only
```

When a connection fails, verify the actual source and destination security groups and ports.

Do not open SSH to the entire Internet as the first troubleshooting step.

---

# 52. Kubernetes Security Troubleshooting

If a pod fails after security hardening, inspect:

```bash
kubectl describe pod <POD> -n <NAMESPACE>
```

Common causes:

- application expects root privileges
- writable directory is not writable
- filesystem is read-only
- wrong UID/GID
- missing secret
- blocked network connection
- insufficient permissions through RBAC

The correct response is to fix the application or permission model, not to remove all security controls.

---

# 53. Jenkins Security Troubleshooting

If Jenkins cannot access a resource:

1. Identify the exact resource.
2. Identify the credential being used.
3. Verify the credential scope.
4. Verify the credential type.
5. Check the Jenkins agent environment.
6. Check whether the pipeline is attempting an action it should not perform.

Do not give Jenkins a permanent administrator-level AWS role just because one API call failed.

---

# 54. GitOps Troubleshooting Flow

When a code change is not deployed, follow this exact chain:

```text
Developer commit
    |
    v
GitHub application repository
    |
    v
Jenkins trigger
    |
    v
CI tests
    |
    v
Security gates
    |
    v
Docker image build
    |
    v
Container registry
    |
    v
GitOps repository image update
    |
    v
Argo CD detects Git change
    |
    v
Kubernetes reconciliation
    |
    v
New Pod
```

Find the first broken link. Do not debug Kubernetes if Jenkins never built the image.

Do not debug Argo if the GitOps repository was never updated.

Do not debug the application if the Pod is still running an old image tag.

---

# 55. Common End-to-End Failure Scenarios

## Scenario 1: Developer commit does not trigger Jenkins

Check:

```text
GitHub webhook -> Jenkins endpoint -> authentication -> job configuration
```

Verify Jenkins logs and webhook delivery status.

Fallback: run the pipeline manually to separate webhook failure from pipeline failure.

---

## Scenario 2: Jenkins test fails

Run the same command locally:

```bash
npm ci
npm test
```

If local and Jenkins results differ, compare:

- Node.js version
- npm version
- environment variables
- OS/base image
- dependency lock file

Do not skip the test stage just because it passes locally.

---

## Scenario 3: Trivy blocks an image

Identify the vulnerability:

```bash
trivy image <IMAGE>:<TAG>
```

Then determine whether the issue comes from:

- application dependency
- operating system package
- base image

Preferred remediation is to update the affected dependency/base image and rebuild.

Do not automatically suppress the finding.

---

## Scenario 4: Argo CD does not deploy the new image

Check:

```text
Was the image pushed?
Was the GitOps repository updated?
Did Argo detect the commit?
Is the application OutOfSync?
Is the new Pod healthy?
```

Use:

```bash
argocd app get <APP_NAME>
kubectl get pods -n <NAMESPACE>
```

---

## Scenario 5: New deployment starts but traffic fails

Check:

```bash
kubectl get pods -n <NAMESPACE>
kubectl get svc -n <NAMESPACE>
kubectl get endpoints -n <NAMESPACE>
kubectl get ingress -n <NAMESPACE>
```

Then test the application health endpoint.

---

## Scenario 6: Application loses data after Pod restart

This is a critical persistence defect.

Check:

- PVC exists
- PVC is mounted at the database path
- application writes to the mounted path
- permissions are correct
- the database is not being created in the container filesystem

Do not accept a deployment that loses SQLite data on a normal Pod restart.

---

## Scenario 7: SQLite reports database locked

Possible causes include concurrent writers, long-running transactions, or incorrect application topology.

Check:

- number of application replicas
- write concurrency
- transaction duration
- SQLite journal/WAL configuration
- application connection handling

Do not solve the problem by blindly increasing replicas. SQLite is intentionally treated as a controlled single-writer workload in this project.

---

## Scenario 8: HTTPS works from one network but not another

Check:

- DNS resolution
- public load balancer
- security groups
- certificate chain
- corporate/VPN proxy behavior
- IPv4/IPv6 records if applicable

Test with:

```bash
curl -Iv https://<DOMAIN>
```

---

# 56. Day-by-Day Tool Installation and Command Checklist

The following section maps tools directly to the 30-day schedule.

## Day 1 — Discovery and AWS Foundation

Install/verify:

```bash
git --version
aws --version
jq --version
```

Run:

```bash
aws sts get-caller-identity
```

Primary output:

```text
requirements.md
architecture.md
decisions.md
aws-network.md
security.md
```

Fallback if AWS CLI authentication fails: verify the approved AWS login method before doing any infrastructure work.

---

## Day 2 — Terraform and VPC

Install/verify:

```bash
terraform version
```

Run:

```bash
terraform fmt -recursive
terraform init
terraform validate
terraform plan
```

Fallback: if `terraform init` fails, inspect provider/network errors and verify AWS authentication with `aws sts get-caller-identity`.

Do not run `terraform apply` until the plan is reviewed.

---

## Day 3 — Routing and Security Groups

Verify AWS access:

```bash
aws sts get-caller-identity
```

Inspect Terraform:

```bash
terraform plan
```

Validation goal:

```text
Public entry point reachable where intended.
Private application not directly exposed.
Required outbound traffic works.
```

Fallback: trace the route table and security group path instead of opening all ports.

---

## Day 4 — Terraform Structure

Run:

```bash
terraform fmt -recursive
terraform validate
terraform plan
```

Review:

```text
modules/
environments/
variables.tf
outputs.tf
```

Fallback: if modules become too abstract, simplify the module boundary. The goal is maintainability, not maximum number of Terraform files.

---

## Day 5 — IAM

Verify:

```bash
aws sts get-caller-identity
```

Review IAM policies and remove unnecessary permissions.

Fallback: if an operation returns `AccessDenied`, identify the exact required API action before modifying the policy.

---

## Day 6 — Ansible

Verify:

```bash
ansible --version
ansible all -i inventory.ini -m ping
```

Run configuration playbooks in a development environment first.

Fallback: use verbose output only when necessary:

```bash
ansible-playbook -i inventory.ini playbook.yml -vv
```

---

## Day 7 — Application Readiness

Run:

```bash
npm ci
npm run
```

Then run the actual available lint/test/build scripts.

Test:

```bash
curl -i http://localhost:<PORT>/health
```

Fallback: if the application has no health endpoint, add one as part of production readiness.

---

## Day 8 — Docker

Verify:

```bash
docker info
```

Build:

```bash
docker build -t app:local .
```

Scan:

```bash
trivy image app:local
```

Run:

```bash
docker run --rm -p <PORT>:<PORT> app:local
```

Fallback: inspect:

```bash
docker logs <CONTAINER_ID>
```

---

## Day 9 — Docker Compose

Validate:

```bash
docker compose config
```

Run:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100
```

Test persistence by restarting containers without deleting volumes.

Fallback: if data disappears, inspect volume configuration before changing the application.

---

## Day 10 — Jenkins CI

Required tools are primarily server-side Jenkins components.

Pipeline sequence:

```text
checkout
npm ci
lint
test
build
```

Fallback: if Jenkins fails, reproduce the exact failing command locally and compare the runtime versions.

---

## Day 11 — DevSecOps Security Gates

Verify locally:

```bash
gitleaks version
trivy --version
npm audit
```

Run:

```bash
gitleaks detect --source . --redact
trivy image <IMAGE>:<TAG>
npm audit --audit-level=high
```

Fallback: investigate each finding rather than disabling the stage.

---

## Day 12 — Registry and Versioning

Build:

```bash
docker build -t <REGISTRY>/<APP>:<VERSION> .
```

Verify:

```bash
docker images
```

Scan:

```bash
trivy image <REGISTRY>/<APP>:<VERSION>
```

Push using the registry's approved authentication mechanism.

Fallback: if push fails, verify registry login, repository permissions, image name, and network connectivity.

---

## Day 13 — Kubernetes Foundation

Verify:

```bash
kubectl version --client
kubectl config current-context
kubectl get nodes
```

If local testing:

```bash
minikube status
```

Fallback: use the project's approved local cluster tool, but do not mix contexts accidentally.

---

## Day 14 — Kubernetes Application Deployment

Validate:

```bash
kubectl apply --dry-run=client -f k8s/
```

Inspect:

```bash
kubectl get pods -n <NAMESPACE>
kubectl get pvc -n <NAMESPACE>
kubectl get svc -n <NAMESPACE>
```

Fallback: use `kubectl describe` on the exact failing resource.

---

## Day 15 — Kubernetes Security and Reliability

Inspect:

```bash
kubectl get serviceaccounts -n <NAMESPACE>
kubectl get networkpolicies -n <NAMESPACE>
```

Test pod recovery by deleting a non-production test Pod:

```bash
kubectl delete pod <POD> -n <NAMESPACE>
```

Fallback: if the replacement Pod does not become Ready, inspect events and logs before changing replicas or security settings.

---

## Day 16 — Infrastructure Integration

Run:

```bash
terraform plan
```

Verify Kubernetes access separately:

```bash
kubectl cluster-info
```

Fallback: identify whether the problem is AWS infrastructure, credentials, Kubernetes access, or application configuration. Do not change all layers at once.

---

## Day 17 — Argo CD

Verify Argo CD CLI if installed:

```bash
argocd version --client
```

Inspect:

```bash
argocd app list
```

Fallback: use the Argo CD UI to inspect application sync state if the CLI is unavailable.

---

## Day 18 — GitOps Repository

Validate Kubernetes YAML:

```bash
kubectl apply --dry-run=client -f <MANIFEST>
```

Review Git diff:

```bash
git diff
```

Fallback: revert an incorrect desired-state change in Git rather than manually patching production resources.

---

## Day 19 — Full CI/CD

Test the complete chain:

```text
Git commit
-> Jenkins
-> tests
-> security
-> Docker
-> registry
-> GitOps commit
-> Argo CD
-> Kubernetes
```

Fallback: identify the first broken stage and debug only that stage first.

---

## Day 20 — Rollback

Record the current image version.

Deploy the next version through GitOps.

Then test rollback by reverting the GitOps change.

Validate:

```bash
kubectl rollout status deployment/<DEPLOYMENT> -n <NAMESPACE>
```

Fallback: use Git revert as the primary GitOps rollback mechanism rather than manual production patching.

---

## Day 21 — Ingress and External Networking

Inspect:

```bash
kubectl get ingress -A
kubectl get svc -A
```

Test:

```bash
curl -I http://<DOMAIN>
```

Fallback: trace from public entry point to Ingress to Service to Pod.

---

## Day 22 — HTTPS

Test:

```bash
curl -Iv https://<DOMAIN>
```

Inspect TLS:

```bash
openssl s_client -connect <DOMAIN>:443 -servername <DOMAIN>
```

Fallback: verify DNS and certificate hostname before changing application code.

---

## Day 23 — Prometheus

Verify monitoring namespace:

```bash
kubectl get pods -n monitoring
```

Validate metrics collection before building dashboards.

Fallback: debug target discovery and scrape errors first.

---

## Day 24 — Grafana

Verify Grafana is running.

Validate Prometheus data source first.

Then create dashboards for:

- CPU
- memory
- Pod availability
- restarts
- request rate
- error rate
- latency

Fallback: if panels show no data, test the data source independently.

---

## Day 25 — Loki

Verify logging components:

```bash
kubectl get pods -n logging
```

First confirm:

```bash
kubectl logs <POD> -n <NAMESPACE>
```

Then verify ingestion into Loki.

Fallback: debug the pipeline from source to collector to Loki to Grafana.

---

## Day 26 — SQLite Backup and Restore

Run the approved backup procedure.

Verify the backup file exists and has the expected size and timestamp.

Restore to an isolated test location.

Run:

```bash
sqlite3 <RESTORED_DB> "PRAGMA integrity_check;"
```

Fallback: if restore fails, do not overwrite the live database. Investigate the backup procedure and file consistency.

---

## Day 27 — Security Review

Run:

```bash
gitleaks detect --source . --redact
npm audit
trivy image <IMAGE>:<TAG>
```

Review:

- IAM
- Security Groups
- Kubernetes RBAC
- Secrets
- NetworkPolicies
- container user
- filesystem permissions
- public exposure

Fallback: document every accepted risk rather than silently ignoring it.

---

## Day 28 — Failure Testing

Test controlled failures:

```text
Pod failure
Readiness failure
Bad image/deployment
Rollback
Database restore
Security gate failure
```

For each test record:

```text
Failure injected
Expected behavior
Observed behavior
Detection method
Recovery action
Recovery time
Evidence
```

Fallback: if a failure test is unsafe in the shared environment, reproduce it in an isolated environment.

---

## Day 29 — End-to-End Validation

Perform a clean end-to-end change.

Trace:

```text
Developer
-> GitHub
-> Jenkins
-> Security gates
-> Registry
-> GitOps
-> Argo CD
-> Kubernetes
-> Ingress
-> Node.js
-> SQLite
```

Then verify:

```text
metrics
logs
alerts
HTTPS
backup
restore
rollback
health
readiness
```

Fallback: use the dependency chain to locate the first failed component.

---

## Day 30 — Production Review and Handover

Run final verification commands appropriate to the environment:

```bash
git status
terraform validate
kubectl get nodes
kubectl get pods -A
kubectl get svc -A
kubectl get ingress -A
```

Verify documentation covers:

```text
Architecture
AWS
Terraform
Ansible
Docker
Jenkins
Security
Kubernetes
Argo CD
Ingress
HTTPS
Prometheus
Grafana
Loki
SQLite
Backup/Restore
Rollback
Troubleshooting
```

Final test: ask a second engineer to follow the documentation without verbal assistance.

If they cannot reproduce the workflow, the documentation is not finished.

---

# 57. Junior Engineer Error Response Template

Whenever a command fails, use this template before asking for help.

```text
DAY:
TOOL:
COMMAND:
EXPECTED RESULT:
ACTUAL RESULT:
ERROR MESSAGE:
CURRENT DIRECTORY:
OS:
TOOL VERSION:
WHAT I TRIED:
LAST SUCCESSFUL STEP:
```

Example:

```text
DAY: 8
TOOL: Docker
COMMAND: docker build -t app:local .
EXPECTED RESULT: Docker image builds successfully.
ACTUAL RESULT: Build fails during npm ci.
ERROR MESSAGE: <paste exact error>
CURRENT DIRECTORY: ~/project
OS: macOS Apple Silicon
TOOL VERSION: Docker <version>
WHAT I TRIED: docker info worked; npm install works locally.
LAST SUCCESSFUL STEP: docker build started successfully.
```

This format prevents random troubleshooting and makes senior-level debugging much faster.

---

# 58. First Response / Fallback / Escalation Pattern

For every failure, use three levels.

## Level 1 — Verify the obvious

Run the tool's version and status command.

Examples:

```bash
docker info
terraform version
aws sts get-caller-identity
kubectl config current-context
argocd app list
```

## Level 2 — Inspect the failing layer

Examples:

```bash
docker logs <CONTAINER>
kubectl describe pod <POD> -n <NAMESPACE>
kubectl logs <POD> -n <NAMESPACE>
terraform plan
ansible-playbook ... -vv
```

## Level 3 — Escalate with evidence

Provide:

- exact command
- exact error
- version
- relevant configuration
- last successful step
- what changed
- logs around the failure

Never send credentials or secret values when sharing troubleshooting output.

---

# 59. Command Safety Classification

## Safe inspection commands

Generally read-only:

```bash
git status
git log
aws sts get-caller-identity
terraform validate
terraform plan
kubectl get
kubectl describe
kubectl logs
docker ps
docker images
docker info
```

## Change commands

Require review:

```bash
terraform apply
kubectl apply
kubectl delete
docker push
git push
ansible-playbook
```

## Potentially destructive commands

Use extreme caution:

```bash
terraform destroy
kubectl delete pvc
kubectl delete namespace
rm -rf
 docker compose down -v
```

Never use destructive commands as generic troubleshooting shortcuts.

---

# 60. Tool-to-Responsibility Reference

| Tool | Responsible for | Not responsible for |
|---|---|---|
| Git | Version history | Deployment |
| GitHub | Source/GitOps repository hosting | CI execution |
| Jenkins | CI | Kubernetes CD |
| Docker | Packaging/runtime image | Cluster orchestration |
| Registry | Image storage | Application deployment |
| Terraform | Infrastructure provisioning | Application configuration |
| Ansible | Machine configuration | Kubernetes GitOps reconciliation |
| Kubernetes | Runtime orchestration | Source control |
| Argo CD | GitOps CD/reconciliation | Application source CI |
| Nginx/Ingress | HTTP routing | Database storage |
| Prometheus | Metrics | Logs |
| Grafana | Visualization/observability UI | Infrastructure provisioning |
| Loki | Logs | CI |
| Gitleaks | Secret detection | Full vulnerability management |
| npm audit | Node dependency audit | Container scanning |
| Trivy | Vulnerability scanning | Deployment orchestration |
| SQLite | Application database | Distributed database scaling |

If a proposed solution gives one tool a responsibility belonging to another tool, stop and review the architecture.

---

# 61. Minimum Definition of Done for Each Tool

A tool is not considered completed merely because it is installed.

## Git

- Repository exists.
- Branch strategy is documented.
- Commits are traceable.
- No secrets are committed.

## AWS

- Network exists.
- Public/private boundaries are understood.
- IAM is least privilege.
- Cost risks are documented.

## Terraform

- Infrastructure is reproducible.
- `terraform validate` passes.
- Plan is reviewed.
- State handling is understood.

## Ansible

- Configuration is repeatable.
- Playbooks are idempotent.
- Hosts are reachable through approved access.

## Docker

- Image builds.
- Container starts.
- Health endpoint works.
- Image is non-root where possible.
- Image passes security scanning policy.

## Jenkins

- Webhook/manual trigger works.
- Tests run.
- Security gates run.
- Image is built and pushed.
- Jenkins does not deploy to Kubernetes.

## Kubernetes

- Application runs.
- Probes work.
- Resources are defined.
- Storage is persistent.
- Security controls are active.

## Argo CD

- GitOps repository is connected.
- Sync works.
- Drift is visible.
- Rollback path is documented.

## Observability

- Metrics are collected.
- Dashboards exist.
- Logs are searchable.
- Important alerts work.

## Backup

- Backup runs.
- Backup is retained.
- Restore has been tested.
- SQLite integrity is verified.

---

# 62. Final Junior Engineer Quick Start

If a junior engineer opens this project for the first time, the recommended sequence is:

```bash
# 1. Check macOS
sw_vers
uname -m

# 2. Check Homebrew
brew --version

# 3. Install core tools if missing
brew install git gh node terraform ansible kubectl helm trivy gitleaks jq yq awscli

# 4. Verify tools
git --version
gh --version
node --version
npm --version
terraform version
ansible --version
kubectl version --client
helm version
trivy --version
gitleaks version
jq --version
yq --version
aws --version

# 5. Authenticate GitHub
# gh auth login

# 6. Verify AWS identity
aws sts get-caller-identity

# 7. Open the application repository
cd <PROJECT_DIRECTORY>

# 8. Inspect package scripts
npm run

# 9. Install dependencies
npm ci

# 10. Check repository status
git status

# 11. Check Docker if Docker Desktop is installed and running
docker info

# 12. Run local application tests according to package.json
npm test

# 13. Build the application according to package.json
npm run build
```

Then stop.

Do not jump to Kubernetes, Argo CD, Terraform apply, or production AWS deployment before the current day's prerequisites and validation gate are complete.

The project is intentionally built as a dependency chain:

```text
Day 1  Understand
  ->
Day 2-6  Provision and configure
  ->
Day 7-12  Make the application buildable, containerized, and secure
  ->
Day 13-20  Run Kubernetes and GitOps delivery
  ->
Day 21-25  Expose and observe
  ->
Day 26-28  Protect and recover
  ->
Day 29-30  Validate and hand over
```

---

# 63. Important Cost and Production Notes

This project prefers free and open-source tooling, but AWS infrastructure is not automatically free merely because the software is open source.

Before creating AWS resources, verify the current AWS pricing and Free Tier eligibility for the exact account, region, and service.

Potentially billable components can include:

- EC2
- EBS
- NAT Gateway
- Load Balancers
- EKS control plane
- data transfer
- public IPv4 addresses
- managed storage
- other managed AWS services

Do not add an AWS service only because it appears in a generic production architecture diagram.

For this project, every AWS service should answer:

```text
Why do we need it?
What problem does it solve?
What is the alternative?
What does it cost?
Can we safely remove it for the learning environment?
```

The architecture should remain production-oriented without pretending that a learning environment has unlimited budget.

---

# 64. Senior Engineer Review Gate

At the end of the project, a senior engineer should be able to ask the junior engineer the following questions.

1. Why are application workloads private?
2. What is the public entry point?
3. Why is Terraform used instead of manually creating infrastructure?
4. Why is Ansible used?
5. Why does Jenkins not deploy to Kubernetes?
6. Why is Argo CD responsible for CD?
7. Where is the desired Kubernetes state stored?
8. How can we identify which Git commit produced a running image?
9. How do we roll back?
10. What happens when a Pod crashes?
11. What happens when readiness fails?
12. Where are application logs stored?
13. Where are application metrics stored?
14. How do we know if the application is unhealthy?
15. How is SQLite persisted?
16. How is SQLite backed up?
17. How was restore tested?
18. What happens if the container image contains a critical vulnerability?
19. What happens if a secret is committed to Git?
20. How are AWS permissions restricted?
21. Which resources are publicly reachable?
22. Why should we not expose the Node.js Pod directly?
23. What happens if the GitOps repository contains a bad deployment?
24. How do we identify the first broken link in CI/CD?
25. Which parts of this architecture are intentionally constrained by SQLite?

A junior engineer who can answer these questions with evidence from the repository and running system understands the workflow rather than merely memorizing commands.

---

# 65. Final Project Operating Model

The finished project should operate according to the following model:

```text
                           DEVELOPER
                               |
                               v
                         +-----------+
                         |  GitHub   |
                         +-----------+
                               |
                               v
                         +-----------+
                         |  Jenkins  |
                         |    CI     |
                         +-----------+
                               |
                  +------------+-------------+
                  |            |             |
                  v            v             v
               Tests       Gitleaks       npm audit
                  |            |             |
                  +------------+-------------+
                               |
                               v
                         +-----------+
                         |  Docker   |
                         +-----------+
                               |
                               v
                         +-----------+
                         |  Trivy    |
                         +-----------+
                               |
                               v
                         +-----------+
                         | Registry  |
                         +-----------+
                               |
                               v
                      +-------------------+
                      | GitOps Repository |
                      +-------------------+
                               |
                               v
                         +-----------+
                         | Argo CD   |
                         +-----------+
                               |
                               v
                    +----------------------+
                    |     Kubernetes       |
                    |                      |
                    | Node.js + SQLite     |
                    | Nginx/Ingress        |
                    +----------------------+
                       |       |       |
                       v       v       v
                  Prometheus  Loki   PVC
                       |       |       |
                       +---+---+-------+
                           |
                           v
                        Grafana
```

The final engineering objective is not to memorize 100 commands.

The objective is to understand the dependency chain, execute each layer safely, validate each layer, recover from failure, and leave enough documentation that another engineer can operate the system without the original author standing beside them.

# End of Junior Engineer Execution Runbook

# Junior Engineer Command, Installation, Validation, and Troubleshooting Runbook

## Purpose

This section is intentionally written for an engineer who may know the concepts but may not know the exact installation command, validation command, expected output, or recovery path.

The rules for this runbook are:

1. Never install a tool without first checking whether it is already installed.
2. Never change infrastructure before running `terraform plan`.
3. Never expose a private Kubernetes workload directly to the Internet when an ingress/load-balancer path is intended.
4. Never put passwords, API keys, AWS access keys, database credentials, or tokens in Git.
5. Never treat a green Jenkins build as proof that the production deployment is healthy.
6. Never treat an Argo CD sync as proof that the application itself is healthy.
7. Every installation must have a verification command.
8. Every major change must have a rollback or recovery path.
9. When a command fails, capture the complete error before changing multiple things.
10. Prefer the smallest safe fix, then rerun the failed validation.

---

# 0. Standard Command Conventions

## 0.1 macOS terminal conventions

The primary developer workstation for this project may be a MacBook. The preferred shell is `zsh`.

```bash
uname -a
arch
sw_vers
zsh --version
xcode-select -p
```

Expected result: macOS information, an architecture such as `arm64`, a valid Xcode Command Line Tools path, and a working zsh version.

If `xcode-select -p` fails, install the Command Line Tools:

```bash
xcode-select --install
```

If the installer says the tools are already installed, continue.

## 0.2 Homebrew prerequisite

Check Homebrew before using any `brew install` command:

```bash
brew --version
brew doctor
```

If the shell reports `brew: command not found`, install Homebrew from the official installer, then load its environment. On Apple Silicon the common shell initialization is:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Then verify:

```bash
which brew
brew --version
```

If `/opt/homebrew` does not exist, do not blindly copy Apple Silicon paths; run:

```bash
which brew
ls /opt/homebrew/bin/brew /usr/local/bin/brew 2>/dev/null
```

Use the path that actually exists.

## 0.3 Linux convention

The AWS hosts in this project may use a Linux distribution. Do not assume that macOS package commands work on Linux.

First identify the operating system:

```bash
cat /etc/os-release
uname -m
```

For Ubuntu/Debian, use `apt` where appropriate. For Amazon Linux, use the package manager supported by the selected Amazon Linux release. Prefer Ansible for repeatable server configuration instead of manually repeating package installation.

## 0.4 Command failure rule

When a command fails, run these before trying a random fix:

```bash
pwd
whoami
uname -a
echo "$SHELL"
which <tool>
<tool> --version
```

Replace `<tool>` with the command that failed.

Then copy the complete error into the project troubleshooting log.

---

# 1. Tool Installation Matrix

| Tool | Primary purpose | macOS install | Verification | Main failure to expect |
|---|---|---|---|---|
| Git | Source control | `brew install git` | `git --version` | PATH / Xcode tools |
| GitHub CLI | GitHub operations | `brew install gh` | `gh --version` | Authentication |
| Node.js | Application runtime | `brew install node@20` | `node -v` | PATH / version |
| npm | Node package manager | Installed with Node | `npm -v` | permissions |
| AWS CLI | AWS management | `brew install awscli` | `aws --version` | credentials |
| Terraform | Infrastructure as Code | `brew tap hashicorp/tap && brew install hashicorp/tap/terraform` | `terraform version` | provider/network |
| Ansible | Server configuration | `brew install ansible` | `ansible --version` | Python/interpreter |
| Docker Desktop | Container runtime | `brew install --cask docker` | `docker version` | daemon not running |
| kubectl | Kubernetes CLI | `brew install kubectl` | `kubectl version --client` | wrong context |
| Helm | Kubernetes package manager | `brew install helm` | `helm version` | repository/network |
| Minikube | Local Kubernetes | `brew install minikube` | `minikube version` | driver |
| Kind | Local Kubernetes alternative | `brew install kind` | `kind version` | Docker runtime |
| Trivy | Container/security scanning | `brew install trivy` | `trivy --version` | database/network |
| Gitleaks | Secret scanning | `brew install gitleaks` | `gitleaks version` | false positives |
| jq | JSON processing | `brew install jq` | `jq --version` | malformed JSON |
| yq | YAML processing | `brew install yq` | `yq --version` | YAML syntax |
| Argo CD CLI | GitOps operations | `brew install argocd` | `argocd version --client` | authentication |
| curl | HTTP testing | Usually preinstalled | `curl --version` | TLS/network |
| openssl | TLS/debugging | Usually preinstalled | `openssl version` | certificate mismatch |

The project does not require every tool to run on every engineer workstation. Some tools run on servers or inside CI/CD. The matrix exists so a junior engineer knows what each tool is for and where it belongs.

---

# 2. Git Installation and Recovery

## Install

```bash
brew install git
```

## Verify

```bash
git --version
which git
git config --global --list
```

## Configure identity

```bash
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR-EMAIL"
```

## Common error: `git: command not found`

If Xcode Command Line Tools are available, verify:

```bash
xcode-select -p
```

Then install Git with Homebrew and open a new terminal if PATH changes were made.

## Common error: `Author identity unknown`

Run the two `git config --global` commands above and retry the commit.

## Common error: authentication failure to GitHub

Prefer GitHub CLI authentication:

```bash
brew install gh
gh auth login
gh auth status
```

Do not put a GitHub personal access token into a repository file or shell history if avoidable.

---

# 3. GitHub CLI Installation and Recovery

## Install

```bash
brew install gh
```

## Verify

```bash
gh --version
gh auth status
```

## Authenticate

```bash
gh auth login
```

Choose GitHub.com, HTTPS or SSH according to the repository policy, and complete browser authentication.

## Error: `You are not logged into any GitHub hosts`

Run:

```bash
gh auth login
gh auth status
```

## Error: repository access denied

Verify the repository URL and account permissions:

```bash
git remote -v
gh repo view OWNER/REPOSITORY
```

Do not immediately change repository permissions. First confirm that the authenticated account is the intended account.

---

# 4. Node.js and npm Installation

The application uses Node.js/Express. The project README should define the exact supported major version. If the project specifies Node 20, use Node 20 rather than installing an arbitrary latest major version.

## macOS installation

```bash
brew install node@20
```

Check:

```bash
node -v
npm -v
which node
which npm
```

If the Homebrew formula is installed but `node` is not found, inspect:

```bash
brew --prefix node@20
```

Then follow the PATH guidance printed by Homebrew.

## Error: `npm: command not found`

This normally means Node is not correctly installed or its `bin` directory is not on PATH. Check:

```bash
brew list node@20
brew --prefix node@20
which node
```

Do not install a second Node distribution until the existing installation is understood.

## Error: `EACCES` during npm installation

Do not solve this by blindly using `sudo npm install` inside the application. Check ownership and the Node installation method first:

```bash
npm config get prefix
npm config get cache
ls -ld "$(npm config get cache)"
```

Use a user-managed Node installation or correct the ownership/configuration rather than creating a root-owned project directory.

## Error: unsupported engine / wrong Node version

Check:

```bash
node -v
cat package.json | grep -A5 'engines'
```

Install the project-supported major version and rerun `npm ci`.

---

# 5. AWS CLI Installation and Credential Troubleshooting

## Install

```bash
brew install awscli
```

## Verify

```bash
aws --version
which aws
```

## Configure

For a learning environment, use the organization's approved authentication method. If access keys are explicitly provided for local CLI use:

```bash
aws configure
```

Then verify identity:

```bash
aws sts get-caller-identity
```

This is the most important first AWS credential test.

## Error: `Unable to locate credentials`

Do not start changing Terraform. First run:

```bash
aws sts get-caller-identity
aws configure list
```

If the project uses AWS SSO/IAM Identity Center, authenticate using the approved SSO flow instead of creating long-lived access keys.

## Error: `AccessDenied`

Capture:

```bash
aws sts get-caller-identity
aws configure list
```

Then identify the exact API action that is denied. The fix is normally an IAM permission or role-assumption issue, not a Terraform syntax problem.

## Error: wrong AWS region

Check:

```bash
aws configure get region
```

Set the project region explicitly in the environment or Terraform variables. Do not scatter region values through multiple files.

---

# 6. Terraform Installation and First Validation

## Install

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

## Verify

```bash
terraform version
which terraform
```

## First project validation

From the Terraform root directory:

```bash
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan
```

## Error: `terraform: command not found`

Check:

```bash
brew --prefix terraform
which terraform
```

Open a new shell if PATH was changed.

## Error: provider plugin download failed

Check Internet/DNS access and retry:

```bash
terraform init
```

If a corporate proxy is required, configure it according to the organization. Do not download random provider binaries from unofficial sources.

## Error: AWS credentials not found during `terraform plan`

Run:

```bash
aws sts get-caller-identity
```

If that fails, fix AWS authentication first. Terraform should not be used as the first tool for diagnosing AWS credentials.

## Error: state lock

Do not delete a lock file or force-unlock without confirming that no other Terraform process is running. First inspect the backend/state design and active CI jobs.

---

# 7. Ansible Installation and Validation

## Install

```bash
brew install ansible
```

## Verify

```bash
ansible --version
ansible-inventory --graph
```

## Test an inventory

```bash
ansible all -i inventory.ini --list-hosts
```

## Test connectivity

```bash
ansible all -i inventory.ini -m ping
```

## Error: `No module named ansible`

Verify the active Python/Ansible installation:

```bash
which ansible
ansible --version
python3 --version
```

Do not mix system Python, Homebrew Python, and virtual environments without understanding which interpreter Ansible is using.

## Error: `UNREACHABLE`

Check network access, host address, SSH/SSM access, firewall rules, and credentials. The Ansible playbook is not the first thing to debug when the host cannot be reached.

## Error: Python interpreter problem on target

Use the target's supported Python interpreter and explicitly configure `ansible_python_interpreter` when necessary.

---

# 8. Docker Desktop Installation and Validation

## Install

```bash
brew install --cask docker
```

Launch Docker Desktop:

```bash
open -a Docker
```

Wait until Docker Desktop reports that the engine is running.

## Verify

```bash
docker version
docker info
docker run --rm hello-world
```

## Error: `Cannot connect to the Docker daemon`

Docker Desktop is probably not running. Start it:

```bash
open -a Docker
```

Then retry:

```bash
docker info
```

## Error: permission denied to Docker socket

On macOS, Docker Desktop manages the runtime differently from a normal Linux Docker socket. Do not apply Linux `usermod` instructions blindly to macOS.

## Error: image pull timeout

Check Docker Desktop networking, DNS, proxy configuration, and registry availability. Retry the same image pull before changing application configuration.

---

# 9. kubectl Installation and Validation

## Install

```bash
brew install kubectl
```

## Verify

```bash
kubectl version --client
which kubectl
```

## Check context

```bash
kubectl config get-contexts
kubectl config current-context
```

## Error: `connection refused`

The selected Kubernetes cluster may not be running, or the kubeconfig may point to a stale endpoint. Run:

```bash
kubectl config current-context
kubectl cluster-info
```

Do not run deployment commands until cluster connectivity works.

## Error: `You must be logged in to the server`

The kubeconfig credentials/token may have expired or the IAM identity may not have Kubernetes access. Re-authenticate using the cluster's approved access mechanism.

## Error: wrong cluster

Always run:

```bash
kubectl config current-context
kubectl get nodes
```

before destructive commands such as deleting deployments, namespaces, or services.

---

# 10. Helm Installation and Recovery

## Install

```bash
brew install helm
```

## Verify

```bash
helm version
helm list -A
```

## Error: repository not found

Add only the required repository from its official documentation, then:

```bash
helm repo update
```

## Error: release already exists

Inspect first:

```bash
helm list -A
helm status RELEASE_NAME -n NAMESPACE
```

Do not uninstall a release just because an installation command failed. The existing release may contain working resources.

---

# 11. Minikube and Kind for Local Kubernetes Testing

These tools are optional local laboratories. They are not substitutes for the production AWS Kubernetes environment.

## Minikube

```bash
brew install minikube
minikube version
minikube start
kubectl get nodes
```

## Error: driver unavailable

Check:

```bash
minikube status
minikube profile list
```

Use a supported driver such as Docker when the local environment supports it.

## Kind

```bash
brew install kind
kind version
kind create cluster --name devops-lab
kubectl cluster-info --context kind-devops-lab
```

Delete only when intentionally resetting the lab:

```bash
kind delete cluster --name devops-lab
```

---

# 12. Trivy Installation and Troubleshooting

## Install

```bash
brew install trivy
```

## Verify

```bash
trivy --version
```

## Scan an image

```bash
trivy image YOUR_IMAGE:TAG
```

## Scan the filesystem

```bash
trivy fs .
```

## Error: vulnerability database download failed

Check network access and retry. If the CI environment is isolated, configure an approved internal cache or registry mirror.

## Error: scan fails the pipeline

Do not automatically suppress the finding. Identify package, severity, fixed version, exploitability/context, and whether the dependency is actually part of the runtime image.

## Temporary controlled exception

If the organization permits an exception, document the reason, owner, expiration date, and compensating control. Never add a permanent ignore merely to make Jenkins green.

---

# 13. Gitleaks Installation and Troubleshooting

## Install

```bash
brew install gitleaks
```

## Verify

```bash
gitleaks version
```

## Scan repository

```bash
gitleaks detect --source . --redact
```

## Error: secret detected

Assume the secret is compromised until proven otherwise. Revoke/rotate the credential first, then remove it from source and history according to the organization's secret-remediation process.

## Error: false positive

Confirm that the finding is not a real credential. Use a narrowly scoped allowlist rule only when justified and documented.

---

# 14. jq and yq Installation

## Install

```bash
brew install jq
brew install yq
```

## Verify

```bash
jq --version
yq --version
```

## JSON test

```bash
echo '{"status":"ok"}' | jq '.status'
```

## YAML test

```bash
echo 'app: healthcare' | yq '.app'
```

## Error: malformed JSON/YAML

Validate the document before using it in automation. A formatting problem should be fixed at the source instead of adding shell hacks around invalid configuration.

---

# 15. Argo CD CLI Installation

## Install

```bash
brew install argocd
```

## Verify

```bash
argocd version --client
```

## Login pattern

The exact server address depends on the deployment. Use the approved Argo CD endpoint and authentication method:

```bash
argocd login ARGOCD_SERVER
```

Then:

```bash
argocd app list
argocd app get APP_NAME
```

## Error: connection refused

Verify that Argo CD is running:

```bash
kubectl get pods -n argocd
kubectl get svc -n argocd
```

Then verify the endpoint/network path.

## Error: application is OutOfSync

Do not immediately click Sync. First inspect:

```bash
argocd app get APP_NAME
kubectl get events -n APPLICATION_NAMESPACE --sort-by=.lastTimestamp
```

Determine whether the drift is expected, a Git change, or an unhealthy resource.

---

# 16. AWS Terraform Networking Command Card

The first AWS infrastructure workflow is always:

```bash
aws sts get-caller-identity
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan
```

Only after the plan has been reviewed:

```bash
terraform apply
```

After apply:

```bash
terraform output
aws ec2 describe-vpcs --filters Name=tag:Project,Values=YOUR_PROJECT
```

Validate subnets and route tables using the AWS CLI or AWS Console.

## Common error: `InvalidSubnet.Range`

The subnet CIDR overlaps another subnet or is outside the VPC range. Recalculate the CIDR plan before applying another change.

## Common error: route target does not exist

The Internet Gateway, NAT resource, or other target may not exist yet. Check Terraform dependency references instead of hardcoding IDs.

## Common error: public subnet is not actually public

A subnet is not public simply because it is named `public`. Its route table must contain a route to an Internet Gateway, and the workload must have an appropriate public addressing strategy.

## Common error: private workload cannot reach Internet

Check the route table, NAT design, security group egress, network ACLs, and DNS. Remember that NAT Gateway has AWS charges; use the cost-approved architecture.

---

# 17. Terraform Recovery Rules

Before any Terraform change:

```bash
terraform fmt -check -recursive
terraform validate
terraform plan
```

If the plan unexpectedly wants to destroy a VPC, subnet, database, Kubernetes cluster, or other critical resource, STOP.

Investigate:

```bash
terraform state list
terraform plan
```

Do not use `terraform apply -auto-approve` for an unexplained destructive plan.

## State-related error

If Terraform says a resource is already managed, inspect state before importing or deleting anything:

```bash
terraform state list
terraform state show RESOURCE_ADDRESS
```

Use `terraform import` only when the resource genuinely exists outside the state and the configuration is ready to manage it.

---

# 18. Application Preparation Command Card

From the application root:

```bash
git status
node -v
npm -v
npm ci
npm run lint
npm test
npm run build
```

If the project does not define one of these scripts, inspect:

```bash
cat package.json
npm run
```

Do not invent script names.

## Error: `npm ci` fails because package-lock is missing

`npm ci` requires a compatible lock file. If the repository intentionally does not commit one, use the project's documented dependency installation policy rather than creating a lock file casually.

## Error: dependency resolution failure

Check Node/npm version, lockfile compatibility, package registry configuration, and the exact package named in the error.

## Error: application starts but API calls fail

Check environment variables, backend port, CORS, database path, and frontend API base URL. Test the backend directly with `curl` before debugging the frontend.

---

# 19. Node.js Health Endpoint Validation

The application should expose a lightweight liveness endpoint and a readiness endpoint where appropriate.

Example validation:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/ready
```

Expected behavior should be documented, for example HTTP 200 for healthy state.

If `/health` fails locally, do not deploy to Kubernetes.

If `/health` works but `/ready` fails, investigate dependencies such as SQLite availability, required configuration, or downstream services.

If the endpoint hangs, investigate event-loop blocking, database locks, or startup code.

---

# 20. Dockerfile Validation Command Card

Build the image:

```bash
docker build -t app:local .
```

Inspect it:

```bash
docker image ls app
```

Run it:

```bash
docker run --rm -p 3000:3000 app:local
```

Test it:

```bash
curl -i http://localhost:3000/health
```

Check logs:

```bash
docker ps
docker logs CONTAINER_ID
```

## Error: container exits immediately

Run it without detaching and inspect the full startup output:

```bash
docker run --rm app:local
```

Common causes include missing environment variables, incorrect start command, wrong working directory, missing build output, and permission errors.

## Error: port already allocated

Find the process/container:

```bash
docker ps
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Use a different host port for local testing rather than changing the application port unnecessarily.

---

# 21. Docker Security Validation

The production image should not run as root unless a documented exception exists.

Check the image metadata:

```bash
docker inspect app:local
```

Check runtime user by opening a temporary shell if available:

```bash
docker run --rm app:local id
```

Check for embedded secrets:

```bash
gitleaks detect --source . --redact
docker history app:local
```

Then scan:

```bash
trivy image app:local
```

A clean Trivy result does not prove the image is secure; it only covers what the scanner can detect.

---

# 22. Docker Compose Validation

Start:

```bash
docker compose up -d --build
```

Check:

```bash
docker compose ps
docker compose logs --tail=200
```

Test:

```bash
curl -i http://localhost:3000/health
```

Stop:

```bash
docker compose down
```

For persistent SQLite testing, do not use `docker compose down -v` unless you intentionally want to delete the volume.

## Error: database disappears after restart

Inspect the volume configuration. SQLite must be stored on persistent storage, not only in the container writable layer.

## Error: service name cannot resolve

Check the Compose network and use the Compose service name for container-to-container communication, not `localhost`.

---

# 23. Jenkins Installation and Bootstrap Guidance

Jenkins is a CI server, not the developer laptop command-line tool.

For a learning lab, Jenkins may run in Docker or on a dedicated Linux host. For production-like operation, document where Jenkins runs, what persistent storage it uses, and how credentials are protected.

## Docker lab option

```bash
docker volume create jenkins_home
docker run -d --name jenkins -p 8080:8080 -p 50000:50000 -v jenkins_home:/var/jenkins_home jenkins/jenkins:lts
```

Then inspect:

```bash
docker logs jenkins
```

Do not expose Jenkins directly to the public Internet without an approved authentication and network design.

## Error: Jenkins container restarts

Check:

```bash
docker ps -a
docker logs jenkins --tail=200
```

Common causes include insufficient memory, permission problems on the Jenkins volume, incompatible plugins, or a Java/runtime issue.

---

# 24. Jenkins Pipeline First-Failure Method

When a Jenkins stage fails, do not rerun the entire pipeline repeatedly without diagnosis.

First identify the stage:

```text
Checkout
Install dependencies
Lint
Unit tests
Integration tests
Build
Gitleaks
npm audit
Docker build
Trivy
Push image
GitOps update
```

Run the equivalent command locally where possible.

For example:

```bash
npm ci
npm run lint
npm test
npm run build
```

Then inspect the Jenkins workspace, credentials, environment variables, and agent capabilities.

## Error: `docker: command not found` in Jenkins

The Jenkins agent does not have Docker CLI/runtime access. Install/configure Docker on the intended agent or use a controlled containerized build strategy.

Do not mount the host Docker socket into arbitrary workloads without understanding the security implications.

## Error: GitHub webhook not triggering Jenkins

Check repository webhook delivery, Jenkins endpoint reachability, CSRF/security configuration, credentials, and job trigger settings.

---

# 25. Gitleaks + npm audit + Trivy CI Policy

Recommended sequence:

```bash
gitleaks detect --source . --redact
npm audit --audit-level=high
trivy image app:CI_TAG
```

The exact severity threshold must be agreed by the project security policy.

## If Gitleaks fails

Treat it as a possible credential exposure first.

## If npm audit fails

Identify whether the vulnerability affects production dependencies, development dependencies, or a transitive dependency.

## If Trivy fails

Identify the vulnerable package and available fixed image/package version.

## If a scanner is unavailable

The pipeline should fail closed for required security gates unless the documented CI policy explicitly allows a controlled temporary exception.

---

# 26. Container Registry Command Card

The exact registry may be Amazon ECR or another approved registry. For Amazon ECR, authenticate through AWS CLI using the approved identity.

Example pattern:

```bash
aws sts get-caller-identity
aws ecr describe-repositories --repository-names YOUR_REPOSITORY
```

Build:

```bash
docker build -t YOUR_IMAGE:YOUR_TAG .
```

Tag according to the registry URI:

```bash
docker tag YOUR_IMAGE:YOUR_TAG REGISTRY_URI/YOUR_IMAGE:YOUR_TAG
```

Push:

```bash
docker push REGISTRY_URI/YOUR_IMAGE:YOUR_TAG
```

Never use only `latest` as the deployment identity. Use immutable or traceable tags such as a Git SHA.

## Error: `no basic auth credentials`

Re-authenticate to the registry using the approved method, then retry the push.

## Error: `denied: User is not authorized`

Check the IAM role/user permissions for the exact ECR action. Do not grant AdministratorAccess merely to make a push work.

---

# 27. Kubernetes Namespace and Resource Validation

Create namespaces through GitOps manifests in the intended deployment model. During a local lab, a direct command may be used for experimentation:

```bash
kubectl create namespace application
kubectl get namespaces
```

Production desired state should live in Git.

Check resources:

```bash
kubectl get pods -A
kubectl get svc -A
kubectl get ingress -A
kubectl get pvc -A
```

## Error: `Pending` pod

Run:

```bash
kubectl describe pod POD_NAME -n NAMESPACE
kubectl get events -n NAMESPACE --sort-by=.lastTimestamp
```

Common causes: insufficient CPU/memory, missing PVC, missing node, taints, scheduling constraints.

## Error: `CrashLoopBackOff`

Run:

```bash
kubectl logs POD_NAME -n NAMESPACE --previous
kubectl describe pod POD_NAME -n NAMESPACE
```

Common causes: bad environment variables, wrong command, missing files, failed database access, or application startup errors.

---

# 28. Kubernetes SQLite Rules

SQLite is intentionally retained for this project.

The production-like design must avoid pretending that SQLite behaves like a horizontally scalable database.

Use a controlled application replica strategy, persistent storage, backup, and restore testing.

## Check the PVC

```bash
kubectl get pvc -n application
kubectl describe pvc PVC_NAME -n application
```

## Check the application pod

```bash
kubectl get pods -n application -o wide
kubectl logs POD_NAME -n application
```

## Error: `database is locked`

Investigate concurrent writers, multiple application replicas, transaction duration, file-system behavior, and application connection handling.

Do not solve a SQLite locking problem by blindly increasing replicas.

## Error: `readonly database`

Check the mounted path and permissions:

```bash
kubectl exec -it POD_NAME -n application -- sh
id
ls -ld DATABASE_DIRECTORY
ls -l DATABASE_FILE
```

The container user must have the intended access to the mounted database path.

---

# 29. Kubernetes Probes and Resources

Every production deployment should define appropriate readiness/liveness behavior and resource requests/limits.

Inspect:

```bash
kubectl get deployment APP_NAME -n application -o yaml
```

If a pod repeatedly restarts:

```bash
kubectl get pod POD_NAME -n application
kubectl describe pod POD_NAME -n application
kubectl logs POD_NAME -n application --previous
```

## Error: readiness probe failed

Test the endpoint from inside the pod if possible:

```bash
kubectl exec -it POD_NAME -n application -- sh
curl -i http://127.0.0.1:3000/ready
```

A readiness failure means the pod should not receive normal traffic. Do not remove the probe just to make the deployment appear healthy.

## Error: OOMKilled

Inspect resource limits and application memory usage. Then determine whether the application has a memory leak or the limit is unrealistically low.

---

# 30. Kubernetes RBAC and Secret Validation

Inspect service accounts:

```bash
kubectl get serviceaccounts -n application
```

Inspect role bindings:

```bash
kubectl get role,rolebinding -n application
kubectl get clusterrole,clusterrolebinding
```

Check secrets without printing their values:

```bash
kubectl get secrets -n application
kubectl describe secret SECRET_NAME -n application
```

Do not use `kubectl get secret SECRET_NAME -o yaml` in a shared terminal or screenshot if it exposes sensitive data.

## Error: application cannot access a resource

First determine whether the application actually needs that permission. Then inspect the ServiceAccount and RBAC binding. Do not grant cluster-admin as a shortcut.

---

# 31. NetworkPolicy Troubleshooting

When NetworkPolicies are introduced, test both allowed and denied traffic.

Inspect:

```bash
kubectl get networkpolicy -A
kubectl describe networkpolicy POLICY_NAME -n NAMESPACE
```

If an application suddenly cannot reach a dependency, identify the source pod, destination service, destination port, namespace selector, and policy direction.

Do not delete all NetworkPolicies to make traffic work. Temporarily isolate the failing rule, fix it, and retest.

---

# 32. Argo CD GitOps Workflow

The expected flow is:

```text
Developer -> GitHub application repository -> Jenkins CI -> image registry -> GitOps repository -> Argo CD -> Kubernetes
```

Jenkins must not become the deployment engine by running `kubectl apply` against production.

Check Argo:

```bash
argocd app list
argocd app get APP_NAME
```

Check Kubernetes:

```bash
kubectl get applications -n argocd
kubectl get pods -n application
```

## Error: OutOfSync

First inspect the diff:

```bash
argocd app diff APP_NAME
```

Determine whether the difference is an intended Git change or unauthorized/manual drift.

## Error: Sync failed

Inspect:

```bash
argocd app get APP_NAME
kubectl get events -n application --sort-by=.lastTimestamp
```

Fix the underlying Kubernetes/resource issue before repeatedly clicking Sync.

---

# 33. Rollback Procedure

A rollback must be a documented operation, not an emergency improvisation.

Preferred GitOps rollback:

```text
Identify bad release -> identify previous known-good Git commit/image -> revert GitOps change -> Argo CD detects desired state -> sync -> verify health
```

Verify:

```bash
kubectl rollout status deployment/APP_NAME -n application
kubectl get pods -n application
curl -i https://YOUR_DOMAIN/health
```

If using Git revert, preserve the incident evidence before deleting logs or branches.

## Error: rollback creates the same failure

The previous release may depend on infrastructure/configuration that has also changed. Compare application image, ConfigMap, Secret references, schema/data changes, and infrastructure state.

---

# 34. Ingress / Nginx Troubleshooting

Expected traffic path:

```text
Internet -> AWS public entry point -> Ingress/Nginx -> Kubernetes Service -> Node.js Pod
```

Check:

```bash
kubectl get ingress -A
kubectl describe ingress INGRESS_NAME -n application
kubectl get svc -n application
kubectl get endpoints -n application
```

## Error: HTTP 502

A 502 commonly means the proxy cannot successfully reach the upstream service. Check Service selectors, endpoints, target port, pod readiness, and application listening address.

## Error: HTTP 404

Check ingress host/path rules and whether the request Host header matches the configured domain.

## Error: service has no endpoints

Compare the Service selector with pod labels:

```bash
kubectl get svc SERVICE_NAME -n application -o yaml
kubectl get pods -n application --show-labels
kubectl get endpoints SERVICE_NAME -n application
```

---

# 35. HTTPS / TLS Troubleshooting

Validate DNS:

```bash
nslookup YOUR_DOMAIN
```

Validate TLS:

```bash
curl -Iv https://YOUR_DOMAIN
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN
```

## Error: certificate mismatch

Check whether the certificate covers the exact hostname and whether the correct listener/Ingress certificate is attached.

## Error: redirect loop

Check whether TLS termination happens at the load balancer, ingress, or application and ensure the proxy/application trust headers are configured consistently.

## Error: certificate expired

Follow the certificate renewal process. Do not disable HTTPS validation as the permanent solution.

---

# 36. Prometheus Installation and Troubleshooting

Prometheus should collect infrastructure and application metrics through an approved Kubernetes monitoring stack or documented configuration.

Check pods:

```bash
kubectl get pods -n monitoring
```

Check services:

```bash
kubectl get svc -n monitoring
```

## Error: target is DOWN

Inspect the target endpoint, ServiceMonitor/PodMonitor or scrape configuration, labels, network policy, and endpoint availability.

## Error: no application metrics

Confirm that the application actually exposes metrics in the expected format and that Prometheus is configured to scrape the correct address/port/path.

Do not assume CPU/memory metrics prove application correctness.

---

# 37. Grafana Installation and Dashboard Troubleshooting

Check:

```bash
kubectl get pods -n monitoring
kubectl logs DEPLOYMENT_OR_POD -n monitoring
```

After login, confirm the Prometheus data source is configured and can successfully query data.

## Error: `No data`

First check Prometheus itself. Then test the same metric directly in Prometheus before debugging Grafana dashboards.

## Error: dashboard shows stale values

Check scrape intervals, target health, time range, timezone, and query filters.

A dashboard is a visualization layer; it does not create metrics that Prometheus is not collecting.

---

# 38. Loki Logging Troubleshooting

Expected flow:

```text
Application logs -> container runtime -> log collector -> Loki -> Grafana
```

Check logging components:

```bash
kubectl get pods -n logging
kubectl get svc -n logging
```

## Error: logs exist in `kubectl logs` but not Grafana

The application/container is producing logs, so investigate the collector, labels, Loki ingestion endpoint, network policy, and Grafana data source.

## Error: no logs anywhere

Check the application process itself:

```bash
kubectl logs POD_NAME -n application
```

Then inspect whether the application is logging to stdout/stderr as intended.

---

# 39. SQLite Backup and Restore Runbook

Backups must be tested, not merely scheduled.

Before backup, identify the actual SQLite file path and storage location.

Example conceptual backup command inside a controlled environment:

```bash
sqlite3 /path/to/app.db ".backup '/backup/app-YYYYMMDD-HHMMSS.db'"
```

Verify the backup:

```bash
sqlite3 /backup/app-YYYYMMDD-HHMMSS.db "PRAGMA integrity_check;"
```

## Error: `database is locked`

Coordinate the backup with application write behavior or use SQLite's supported backup mechanism. Do not copy a live database file blindly and assume the result is consistent.

## Restore test

Restore into a separate test location first. Validate integrity and application startup before considering a production restore complete.

## Error: backup exists but cannot be restored

Check file permissions, SQLite version compatibility, storage capacity, corruption, and whether the backup process copied a consistent database.

---

# 40. Monitoring and Alert Validation

At minimum, validate alerts for:

- Application unavailable.
- Excessive HTTP 5xx errors.
- High latency.
- Pod restart spikes.
- CPU saturation.
- Memory saturation.
- PVC/storage capacity risk.
- Prometheus target failure.
- Log pipeline failure where measurable.

For every alert, document:

```text
Condition
Severity
Owner
Notification channel
First investigation command
Likely causes
Immediate mitigation
Permanent fix
```

An alert without an actionable runbook is incomplete operational engineering.

---

# 41. Daily Junior Engineer Workflow Template

Every implementation day should follow the same structure:

```text
1. Read today's objective.
2. Confirm prerequisites.
3. Check installed tool versions.
4. Make the smallest intended change.
5. Run validation commands.
6. Record output/evidence.
7. Trigger one controlled failure if the day's topic requires recovery testing.
8. Fix the failure.
9. Re-run validation.
10. Mark the Definition of Done only after the evidence exists.
```

If step 5 fails, do not skip directly to step 10.

---

# 42. Day 1 — Discovery and Architecture: Junior Execution

## Install/check commands

```bash
git --version
node -v
npm -v
docker version
aws --version
terraform version
ansible --version
kubectl version --client
```

## Work

Inspect `package.json`, environment examples, application entry points, database path, build scripts, test scripts, and current deployment assumptions.

Create the architecture document and explicitly label public versus private components.

## Validation

```bash
npm ci
npm run lint
npm test
npm run build
```

If any command does not exist, inspect `npm run` and document the project's actual scripts.

## Likely errors

- Node version mismatch.
- Missing lockfile.
- Missing environment variable.
- Database file permission issue.
- Test assumes a service that is not running.

## Recovery

Fix one prerequisite at a time, rerun the failed command, and record the root cause in `docs/troubleshooting.md`.

## Day 1 Definition of Done

A junior engineer can explain the application, deployment path, data path, public/private boundary, CI/CD flow, and all required prerequisites without guessing.

---

# 43. Day 2 — Terraform and VPC: Junior Execution

## Install/check

```bash
terraform version
aws sts get-caller-identity
```

## Commands

```bash
cd infrastructure/terraform
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan
```

Review the plan before applying.

Apply only after approval:

```bash
terraform apply
```

## Likely errors

- AWS credentials missing.
- Provider download failure.
- CIDR overlap.
- Resource already exists.
- Permission denied.

## Recovery

Credential issue -> fix AWS identity.

CIDR issue -> fix network design.

Existing resource -> determine whether it should be imported or replaced.

Permission issue -> identify the exact IAM action.

## Validation

```bash
terraform output
aws ec2 describe-vpcs --filters Name=tag:Project,Values=YOUR_PROJECT
```

## Day 2 Definition of Done

VPC and subnets exist according to the approved CIDR plan and the Terraform state matches the real infrastructure.

---

# 44. Day 3 — Routing and Security Groups: Junior Execution

## Work

Validate Internet Gateway, public route tables, private route tables, security groups, and the approved outbound strategy.

## Commands

```bash
terraform plan
aws ec2 describe-route-tables
aws ec2 describe-security-groups
```

## Likely errors

- Private subnet has no outbound path.
- Public subnet has no IGW route.
- Security group blocks required traffic.
- Security group exposes a management port to `0.0.0.0/0`.

## Recovery

Trace the packet path from source to destination. Do not open all ports as a debugging shortcut.

## Validation

Confirm that public entry is reachable only where intended and private workloads are not directly Internet exposed.

## Day 3 Definition of Done

Every required network flow is documented and tested, and every unnecessary public path is closed.

---

# 45. Day 4 — Terraform Structure: Junior Execution

## Commands

```bash
terraform fmt -recursive
terraform validate
terraform plan
```

Inspect modules and variables:

```bash
find . -maxdepth 3 -type f | sort
```

## Likely errors

- Incorrect module source.
- Missing variable.
- Duplicate resource names.
- Hardcoded environment values.

## Recovery

Use Terraform error line numbers first. Fix module inputs before changing provider configuration.

## Validation

A fresh engineer should be able to identify networking, IAM, compute, and environment-specific configuration without searching through one giant file.

## Day 4 Definition of Done

Terraform is modular, formatted, validated, reviewable, and reproducible.

---

# 46. Day 5 — IAM: Junior Execution

## Commands

```bash
aws sts get-caller-identity
aws iam get-account-summary
```

Use AWS Console/IAM APIs according to organizational policy.

## Work

Define roles for Terraform, CI, Kubernetes workloads, and operations. Separate human access from workload access.

## Likely errors

- AccessDenied.
- Wrong role assumption.
- Expired SSO session.
- Missing permission boundary.

## Recovery

Identify the exact denied action and resource. Grant the minimum required permission only after confirming the need.

## Validation

Attempt intended operations with the least-privileged identity and verify that unrelated privileged operations are denied.

## Day 5 Definition of Done

No long-lived production secret is stored in Git, source code, Dockerfiles, or Kubernetes manifests.

---

# 47. Day 6 — Ansible: Junior Execution

## Commands

```bash
ansible --version
ansible-inventory -i inventory.ini --graph
ansible all -i inventory.ini -m ping
ansible-playbook -i inventory.ini playbooks/site.yml --check
```

Only after check mode is understood:

```bash
ansible-playbook -i inventory.ini playbooks/site.yml
```

## Likely errors

- UNREACHABLE.
- SSH authentication failure.
- Python interpreter missing.
- Package manager mismatch.

## Recovery

Fix host reachability and interpreter issues before modifying playbook logic.

## Validation

Run the playbook a second time and confirm it reports minimal/no unnecessary changes.

## Day 6 Definition of Done

Server configuration is repeatable and idempotent.

---

# 48. Day 7 — Application Readiness: Junior Execution

## Commands

```bash
npm ci
npm run lint
npm test
npm run build
npm start
```

In another terminal:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/ready
```

## Likely errors

- Port already in use.
- Missing environment variable.
- SQLite permission issue.
- Build output missing.

## Recovery

Check `package.json`, `.env.example`, process logs, and database path. Never commit a real `.env` file containing secrets.

## Validation

Application starts from a clean checkout using documented environment setup.

## Day 7 Definition of Done

A junior engineer can build and start the application without undocumented manual steps.

---

# 49. Day 8 — Dockerization: Junior Execution

## Commands

```bash
docker build -t app:dev .
docker run --rm -p 3000:3000 app:dev
curl -i http://localhost:3000/health
```

Security:

```bash
trivy image app:dev
gitleaks detect --source . --redact
```

## Likely errors

- Docker daemon unavailable.
- Missing file in build context.
- Wrong CMD.
- Container runs as root.
- Port mismatch.

## Recovery

Use:

```bash
docker build --progress=plain -t app:debug .
docker run --rm app:debug
```

The detailed build output usually identifies missing files or commands.

## Day 8 Definition of Done

The application runs from a minimal reproducible image and the image passes required security gates.

---

# 50. Day 9 — Docker Compose: Junior Execution

## Commands

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=200
```

Test:

```bash
curl -i http://localhost:3000/health
```

## Likely errors

- Invalid Compose YAML.
- Port conflict.
- Volume permission issue.
- Service dependency unavailable.

## Recovery

Run `docker compose config` first. It catches many configuration problems before containers start.

## Day 9 Definition of Done

Local containerized startup, persistence, restart, logging, and shutdown behavior are verified.

---

# 51. Day 10 — Jenkins CI: Junior Execution

## Commands outside Jenkins

```bash
npm ci
npm run lint
npm test
npm run build
gitleaks detect --source . --redact
```

## Work inside Jenkins

Create the pipeline from the repository `Jenkinsfile`. Configure GitHub integration and credentials through Jenkins credentials management.

## Likely errors

- Git checkout failure.
- Node unavailable on agent.
- npm command unavailable.
- GitHub webhook not delivered.
- Jenkins agent offline.

## Recovery

Run the exact failed shell command on the Jenkins agent. Verify tool versions on that agent rather than on the developer laptop.

## Day 10 Definition of Done

A Git push triggers Jenkins and a clean commit passes the defined CI stages.

---

# 52. Day 11 — DevSecOps Gates: Junior Execution

## Commands

```bash
gitleaks detect --source . --redact
npm audit --audit-level=high
docker build -t app:security .
trivy image app:security
```

## Likely errors

- Secret detected.
- High vulnerability.
- Trivy database unavailable.
- False positive.

## Recovery

Never suppress a real secret. Rotate first.

For vulnerabilities, identify the dependency and fixed version.

For false positives, document and narrowly suppress only through approved policy.

## Day 11 Definition of Done

CI blocks releases when required security gates fail.

---

# 53. Day 12 — Registry: Junior Execution

## Commands

```bash
aws sts get-caller-identity
aws ecr describe-repositories --repository-names YOUR_REPOSITORY
docker build -t app:$(git rev-parse --short HEAD) .
```

Then tag and push using the registry URI.

## Likely errors

- Repository missing.
- ECR authorization failure.
- Image tag mismatch.
- Registry network failure.

## Recovery

Verify AWS identity and exact repository name before changing IAM.

## Day 12 Definition of Done

Every published image can be traced back to a Git commit and Jenkins build.

---

# 54. Day 13 — Kubernetes Foundation: Junior Execution

## Commands

```bash
kubectl cluster-info
kubectl get nodes
kubectl get namespaces
kubectl get storageclass
```

Create/test a local namespace if needed:

```bash
kubectl create namespace application
kubectl get namespace application
```

## Likely errors

- No cluster connection.
- Wrong context.
- Node NotReady.
- Missing storage class.

## Recovery

Fix cluster access first, then node health, then storage.

## Day 13 Definition of Done

Cluster access, namespaces, nodes, and storage strategy are known and documented.

---

# 55. Day 14 — Kubernetes Application Deployment: Junior Execution

## Commands

```bash
kubectl apply -f k8s/
kubectl get deployment -n application
kubectl get pods -n application
kubectl get svc -n application
kubectl get pvc -n application
```

Wait for rollout:

```bash
kubectl rollout status deployment/APP_NAME -n application
```

## Likely errors

- ImagePullBackOff.
- CrashLoopBackOff.
- Pending PVC.
- Missing Secret.

## Recovery

Use:

```bash
kubectl describe pod POD_NAME -n application
kubectl logs POD_NAME -n application --previous
kubectl describe pvc PVC_NAME -n application
```

## Day 14 Definition of Done

Application deployment, service, probes, resources, secrets, and persistent storage work as designed.

---

# 56. Day 15 — Kubernetes Security and Reliability: Junior Execution

## Commands

```bash
kubectl get serviceaccounts -n application
kubectl get role,rolebinding -n application
kubectl get networkpolicy -n application
```

Inspect security context:

```bash
kubectl get deployment APP_NAME -n application -o yaml
```

## Failure test

Delete one application pod and observe Kubernetes replacement:

```bash
kubectl delete pod POD_NAME -n application
kubectl get pods -n application -w
```

## Likely errors

- Replacement pod cannot schedule.
- ServiceAccount permission denied.
- NetworkPolicy blocks dependency.

## Day 15 Definition of Done

The application is least-privileged, non-root where possible, network-restricted, and self-healing for normal pod failure.

---

# 57. Day 16 — Infrastructure Integration: Junior Execution

## Commands

```bash
terraform plan
terraform output
kubectl get nodes
kubectl get storageclass
```

## Work

Map Terraform outputs to the deployment process. Remove undocumented manual steps.

## Likely errors

- Terraform creates infrastructure that Kubernetes configuration does not reference.
- Wrong region/account.
- Missing storage or networking integration.

## Recovery

Trace the dependency from Terraform output to Kubernetes configuration to application behavior.

## Day 16 Definition of Done

Infrastructure dependencies are reproducible and documented.

---

# 58. Day 17 — Argo CD: Junior Execution

## Commands

```bash
kubectl get pods -n argocd
kubectl get svc -n argocd
argocd version --client
argocd app list
```

## Likely errors

- Argo CD pods not ready.
- Repository authentication failure.
- Application definition invalid.

## Recovery

Inspect:

```bash
kubectl get events -n argocd --sort-by=.lastTimestamp
kubectl logs POD_NAME -n argocd
```

## Day 17 Definition of Done

Argo CD can read the GitOps repository and report application health/sync state.

---

# 59. Day 18 — GitOps Repository: Junior Execution

## Commands

```bash
git status
git diff
git add .
git commit -m "Update application image"
git push
```

Then:

```bash
argocd app get APP_NAME
```

## Likely errors

- YAML syntax failure.
- Wrong image tag.
- Invalid Kubernetes field.
- Argo cannot access repository.

## Recovery

Validate manifests before push:

```bash
kubectl apply --dry-run=client -f k8s/
```

Use repository-specific lint/validation tools where available.

## Day 18 Definition of Done

Git is the source of desired deployment state and manual cluster changes are not the normal deployment mechanism.

---

# 60. Day 19 — Complete CI/CD Integration: Junior Execution

## Expected chain

```text
Git push
-> Jenkins
-> tests
-> security scans
-> Docker build
-> registry push
-> GitOps repository update
-> Argo CD
-> Kubernetes
```

## Validation commands

```bash
kubectl rollout status deployment/APP_NAME -n application
kubectl get pods -n application
curl -i https://YOUR_DOMAIN/health
```

## Likely errors

A green CI pipeline with an unhealthy deployment means CI and CD are separate signals. Check Argo and Kubernetes instead of rerunning Jenkins blindly.

## Day 19 Definition of Done

One approved Git change can travel through the complete automated delivery chain.

---

# 61. Day 20 — Rollout, Failure, and Rollback: Junior Execution

Deploy a known-good release first.

Then introduce a controlled bad release in a non-production environment.

Observe:

```bash
kubectl get pods -n application -w
kubectl rollout status deployment/APP_NAME -n application
argocd app get APP_NAME
```

Rollback by reverting the GitOps change according to the approved Git workflow.

## Likely errors

- Rollback image unavailable.
- Previous release incompatible with current configuration.
- Database/data change not backward compatible.

## Day 20 Definition of Done

The team can recover from a bad application release using GitOps without manually editing production manifests.

---

# 62. Day 21 — Ingress and External Networking: Junior Execution

## Commands

```bash
kubectl get ingress -A
kubectl describe ingress INGRESS_NAME -n application
kubectl get svc -n application
kubectl get endpoints -n application
```

## Test

```bash
curl -I http://YOUR_DOMAIN
```

## Likely errors

- 404.
- 502.
- No address assigned.
- Service has no endpoints.

## Recovery

Trace:

```text
DNS -> load balancer -> ingress -> service -> endpoint -> pod
```

Fix the first broken link rather than changing all layers.

## Day 21 Definition of Done

The public traffic path works while application pods remain private.

---

# 63. Day 22 — HTTPS and Application Security: Junior Execution

## Commands

```bash
curl -Iv https://YOUR_DOMAIN
openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN
```

## Likely errors

- Certificate mismatch.
- Expired certificate.
- Redirect loop.
- HTTP still accessible when policy requires redirect.

## Recovery

Verify DNS, certificate hostname, TLS termination location, listener/Ingress configuration, and forwarded protocol headers.

## Day 22 Definition of Done

The application is reachable over HTTPS with the intended certificate and secure redirect behavior.

---

# 64. Day 23 — Prometheus: Junior Execution

## Commands

```bash
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

Validate targets in the Prometheus UI and query basic Kubernetes/application metrics.

## Likely errors

- Target down.
- Metrics endpoint unavailable.
- ServiceMonitor labels do not match.
- NetworkPolicy blocks scraping.

## Recovery

Check the exact target endpoint and network path.

## Day 23 Definition of Done

Infrastructure and application health metrics are being collected.

---

# 65. Day 24 — Grafana: Junior Execution

## Commands

```bash
kubectl get pods -n monitoring
kubectl logs POD_NAME -n monitoring
```

## Validation

Confirm Prometheus data source health and verify dashboard queries return current data.

## Likely errors

- No data.
- Wrong time range.
- Wrong metric label.
- Prometheus data source unavailable.

## Recovery

Query Prometheus directly first. If Prometheus has data, then debug Grafana configuration/querying.

## Day 24 Definition of Done

Dashboards provide actionable infrastructure and application visibility.

---

# 66. Day 25 — Loki: Junior Execution

## Commands

```bash
kubectl get pods -n logging
kubectl get svc -n logging
kubectl logs POD_NAME -n logging
```

## Validation

Confirm that application logs appear in Loki through Grafana.

## Likely errors

- Collector not running.
- Loki unreachable.
- Labels incorrect.
- Grafana datasource misconfigured.

## Recovery

First prove logs exist with `kubectl logs`, then trace the logging pipeline one hop at a time.

## Day 25 Definition of Done

Engineers can find application startup, error, authentication, and database logs centrally.

---

# 67. Day 26 — SQLite Backup and Restore: Junior Execution

## Commands

Identify database path, then perform an approved SQLite backup:

```bash
sqlite3 /path/to/app.db ".backup '/backup/app-test.db'"
sqlite3 /backup/app-test.db "PRAGMA integrity_check;"
```

## Likely errors

- Database locked.
- Backup path unavailable.
- Permission denied.
- Corrupt backup.

## Recovery

Use SQLite's backup mechanism, validate the backup, and restore into an isolated test location before production recovery.

## Day 26 Definition of Done

A tested backup can be restored and verified.

---

# 68. Day 27 — Full DevSecOps Hardening: Junior Execution

## Commands

```bash
gitleaks detect --source . --redact
trivy image APP_IMAGE:TAG
npm audit --audit-level=high
kubectl get role,rolebinding -n application
kubectl get networkpolicy -n application
```

## Review

Check AWS IAM, security groups, Kubernetes RBAC, secrets, container user, image vulnerabilities, network policies, and CI credentials.

## Likely errors

- Overprivileged IAM.
- Cluster-admin ServiceAccount.
- Public management port.
- Secrets in Git.

## Recovery

Reduce privileges systematically and retest the actual workflow after each change.

## Day 27 Definition of Done

Security controls are implemented, tested, documented, and not merely listed.

---

# 69. Day 28 — Failure Testing and Recovery: Junior Execution

Run controlled tests:

```bash
kubectl delete pod POD_NAME -n application
```

Break readiness in a test deployment and observe traffic removal.

Deploy a deliberately invalid image tag in a non-production GitOps environment.

Test backup restoration into an isolated environment.

Break a CI security gate with a safe test fixture rather than a real credential.

Record expected behavior, observed behavior, detection method, recovery command, and recovery time.

## Day 28 Definition of Done

Failure behavior is known before a real incident occurs.

---

# 70. Day 29 — End-to-End Production Validation: Junior Execution

## Trace

```text
Developer
-> GitHub
-> Jenkins
-> tests/security
-> Docker
-> registry
-> GitOps
-> Argo CD
-> Kubernetes
-> ingress
-> Node.js
-> SQLite
```

## Validate

```bash
git log -1
kubectl get pods -n application
kubectl get svc -n application
kubectl get ingress -n application
argocd app get APP_NAME
curl -i https://YOUR_DOMAIN/health
```

Check Grafana and Loki for the same release.

## Day 29 Definition of Done

The release is traceable from source commit to running workload, metrics, logs, and backup state.

---

# 71. Day 30 — Documentation and Handover: Junior Execution

## Required documents

```text
README.md
architecture.md
aws-network.md
terraform.md
ansible.md
docker.md
jenkins.md
kubernetes.md
argocd.md
monitoring.md
logging.md
backup-restore.md
security.md
troubleshooting.md
runbook.md
```

## Final commands

```bash
git status
terraform fmt -check -recursive
terraform validate
terraform plan
kubectl get nodes
kubectl get pods -A
argocd app list
```

## Final handover test

Ask a second engineer to perform a deployment, identify a failed pod, inspect logs, inspect metrics, perform a rollback, and explain the backup/restore procedure without the original author guiding every command.

## Day 30 Definition of Done

The project is operationally transferable, reproducible, observable, secure, recoverable, and documented.

---

# 72. Master Troubleshooting Decision Tree

## If the application is down

```text
Is DNS resolving?
  -> No: fix DNS.
  -> Yes: continue.
Is HTTPS/TLS valid?
  -> No: fix certificate/listener/Ingress.
  -> Yes: continue.
Does the load balancer/Ingress have a healthy backend?
  -> No: inspect Service/endpoints/pods.
  -> Yes: continue.
Is the Service pointing to the correct pods?
  -> No: fix selector/labels.
  -> Yes: continue.
Are pods Ready?
  -> No: inspect readiness and logs.
  -> Yes: continue.
Does /health work inside the pod?
  -> No: debug application.
  -> Yes: inspect proxy/network policy.
```

## If Jenkins is red

```text
Identify failed stage.
Run the exact command locally or on the same Jenkins agent.
Check tool version.
Check credentials.
Check network access.
Check workspace.
Check environment variables.
Fix root cause.
Rerun the smallest failed test.
Then rerun the pipeline.
```

## If Argo CD is red

```text
Check application status.
Check sync status.
Check diff.
Check Kubernetes events.
Check pod logs.
Check manifest syntax.
Check image availability.
Check Secret/ConfigMap references.
Check RBAC.
Then sync again.
```

## If Kubernetes pod is failing

```text
kubectl get pod
kubectl describe pod
kubectl logs
kubectl logs --previous
kubectl get events
kubectl get svc
kubectl get endpoints
kubectl get pvc
kubectl get secret
kubectl get configmap
```

Always inspect evidence before changing configuration.

---

# 73. Error-to-Response Quick Reference

| Error | First response | Do not do first |
|---|---|---|
| `brew: command not found` | Check Homebrew installation/PATH | Reinstall every tool manually |
| `node: command not found` | Check Node installation/PATH | Use random Node installers |
| `npm EACCES` | Check npm prefix/cache ownership | `sudo npm install` everywhere |
| `Unable to locate credentials` | `aws sts get-caller-identity` | Change Terraform code |
| `AccessDenied` | Identify denied API action/resource | Grant AdministratorAccess |
| `terraform init` fails | Check provider/network/credentials | Delete state blindly |
| Terraform destructive plan | STOP and inspect plan/state | `terraform apply -auto-approve` |
| Docker daemon unavailable | Start Docker runtime | Reinstall application |
| `ImagePullBackOff` | Describe pod and inspect events | Change Kubernetes randomly |
| `CrashLoopBackOff` | Read current/previous logs | Increase replicas blindly |
| PVC Pending | Describe PVC and events | Delete PVC immediately |
| `database is locked` | Check concurrent writers | Add replicas blindly |
| `readonly database` | Check mounted path/user permissions | Run container as root permanently |
| Jenkins webhook fails | Check delivery and endpoint | Rewrite Jenkinsfile first |
| Gitleaks finds secret | Rotate/revoke credential | Ignore the finding |
| Trivy finds vulnerability | Identify package/fix | Disable scanner |
| Argo OutOfSync | Inspect diff | Sync blindly |
| Ingress 502 | Check endpoints/pod readiness/port | Open all firewall ports |
| HTTPS certificate error | Check hostname/cert/listener | Disable TLS verification |
| Prometheus target down | Check target endpoint/config/network | Reinstall Grafana |
| Grafana no data | Test Prometheus directly | Rebuild dashboards |
| Loki no logs | Check `kubectl logs`, collector, Loki | Assume app has no logs |
| SQLite restore fails | Test integrity and file/path | Delete the only backup |

---

# 74. Tool Installation Checklist for a Fresh Mac

Run the following in order. Stop when a prerequisite fails.

```bash
xcode-select -p
brew --version
git --version
gh --version
node -v
npm -v
aws --version
terraform version
ansible --version
docker version
kubectl version --client
helm version
trivy --version
gitleaks version
jq --version
yq --version
argocd version --client
```

If Homebrew is missing, install it first.

If Docker is installed but the daemon is unavailable, start Docker Desktop.

If AWS CLI is installed but credentials fail, fix authentication before Terraform.

If Terraform is installed but `init` fails, fix provider/network access before changing infrastructure code.

If kubectl is installed but the cluster is unavailable, fix kubeconfig/context before deploying.

If Argo CLI is installed but Argo is unreachable, check the Argo CD server and network path.

---

# 75. Fresh Mac Bootstrap Commands

For a new Apple Silicon Mac, a junior engineer can use this checklist after reviewing company security policy:

```bash
xcode-select --install
```

Install Homebrew using the official Homebrew installation method, then:

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
brew update
brew install git gh node@20 awscli ansible kubectl helm minikube kind trivy gitleaks jq yq argocd
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
brew install --cask docker
open -a Docker
```

Then validate:

```bash
git --version
gh --version
node -v
npm -v
aws --version
terraform version
ansible --version
docker version
kubectl version --client
helm version
trivy --version
gitleaks version
jq --version
yq --version
argocd version --client
```

Do not run every command with `sudo`.

Do not store AWS credentials in the repository.

Do not commit `.env` files containing secrets.

Do not install production software from untrusted download sites merely because a command failed.

---

# 76. Optional Linux Bootstrap Reference

The exact production host operating system must be decided before finalizing these commands.

Start with:

```bash
cat /etc/os-release
uname -m
whoami
```

Then use the distribution's supported package manager.

For Ubuntu/Debian, a typical base preparation begins with:

```bash
sudo apt-get update
sudo apt-get install -y git curl unzip jq
```

Install AWS CLI, Terraform, Docker, kubectl, Helm, and other tools using their approved official repositories/packages or Ansible roles.

Do not mix package sources without documenting why.

For production, prefer Ansible to make the final installation reproducible.

After installation, run the same verification matrix used on macOS.

---

# 77. What to Capture When Any Error Happens

Every meaningful failure should produce an incident/debug record containing:

```text
Date/time:
Engineer:
Environment:
Command:
Full error:
Expected result:
Actual result:
Last known good state:
Likely cause:
Evidence checked:
Fix attempted:
Fix result:
Validation command:
Validation result:
Permanent prevention:
```

Never write passwords, access tokens, private keys, or other secrets into this record.

If logs contain secrets, redact them before committing the troubleshooting document.

This process turns individual debugging into organizational knowledge.

---

# 78. Junior Engineer Stop Conditions

A junior engineer must stop and ask for review when:

1. Terraform proposes unexpected destruction.
2. A production database or persistent volume is about to be deleted.
3. IAM permissions need AdministratorAccess to make the workflow work.
4. A secret is discovered in Git.
5. A security scanner finding is being suppressed.
6. A production NetworkPolicy is being removed to restore traffic.
7. A Kubernetes production namespace is about to be deleted.
8. A certificate or DNS change affects unrelated production domains.
9. A backup is the only remaining copy of production data.
10. The engineer cannot explain the blast radius of the proposed change.

Stopping is not failure. Making an uncontrolled production change without understanding the impact is the failure.

---

# 79. Senior Engineer Review Checklist

Before marking the 30-day project complete, the senior reviewer should verify:

- The application is reproducibly built.
- Docker images are traceable to Git commits.
- Jenkins performs CI only.
- Argo CD performs GitOps deployment.
- Terraform owns infrastructure declared in Terraform.
- Ansible owns server configuration declared in Ansible.
- Kubernetes manifests define desired workload state.
- Secrets are not stored in Git.
- IAM is least privilege.
- Security groups are not unnecessarily open.
- Kubernetes workloads are private behind the intended ingress/load-balancer path.
- Containers do not unnecessarily run as root.
- Resource requests and limits are present where appropriate.
- Readiness and liveness behavior is tested.
- NetworkPolicies are tested.
- Prometheus metrics are available.
- Grafana dashboards are useful.
- Loki logs are searchable.
- SQLite backups are scheduled and tested.
- SQLite restore is tested.
- Rollback is tested.
- Failure scenarios are documented.
- HTTPS is validated.
- Runbooks contain actual commands, not only descriptions.

---

# 80. Final Junior Engineer Rule

The engineer should never memorize the entire toolchain.

The engineer should know how to answer five questions for every tool:

1. Why do we use this tool?
2. Where does this tool run?
3. What is the first command to verify it?
4. What is the most likely failure?
5. What is the safest next diagnostic step?

If those five answers are documented for every layer, the project becomes teachable, reproducible, and operationally maintainable.

# End of Junior Engineer Command, Installation, Validation, and Troubleshooting Runbook
