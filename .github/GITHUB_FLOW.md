# ✅ GitHub Flow Workflow (Full Version)

> Core principle: **"The main branch must always be deployable; all development is done through Pull Requests"**  
> GitHub Flow is simple, fast, and optimized for efficient developer collaboration.

## 🚀 Overview

GitHub Flow is a lightweight Git branching workflow designed for modern web development, agile teams, and continuous deployment scenarios. It prioritizes simplicity, speed, and integration with CI/CD pipelines.

## ✅ Branch Structure

GitHub Flow typically involves only two core types of branches:

- **`main` (or `master`)**: The main branch, which **must always be deployable**  
- **`feature/*` or `fix/*`**: Temporary branches used for development. Changes are merged into `main` via Pull Request.

> 💡 GitHub Flow does **not use** `develop`, `release`, or `hotfix` branches—it's a streamlined process.

### 📌 Branch Naming Conventions

| Branch Type    | Scope / Usage Example                                      |
|----------------|------------------------------------------------------------|
| `feature/*`    | New features, UI pages, modules (`feature/login-page`)     |
| `fix/*`        | Bug fixes, production hotfixes (`fix/api-response-crash`)  |

These two branch types already cover **80%+** of daily development tasks.

For other work types, you may **optionally** use the following formats, or still categorize them under `feature/` or `fix/` for consistency:

| Optional Prefix | Use Case                               | Example                             |
|------------------|------------------------------------------|--------------------------------------|
| `docs/*`         | Documentation updates                    | `feature/docs-api-usage`             |
| `refactor/*`     | Code refactoring (no behavior change)    | `feature/refactor-user-service`      |
| `test/*`         | Test-related changes                     | `fix/test-coverage-auth-service`     |

You can group them under `feature/` or `fix/` depending on whether they introduce new work or fix/adjust existing behavior.

---

## 🧩 Development Workflow

1. **Create a Branch**  
   From `main`, create a branch with a clear prefix:  
   Example: `git checkout -b feature/login-form`

2. **Work Locally & Push**  
   Make commits to your branch. Push to GitHub regularly.  
   Example: `git push origin feature/login-form`

3. **Open a Pull Request (PR)**  
   Once ready, open a PR targeting the `main` branch.  
   Request reviews from your team.

4. **CI/CD Integration**  
   Automatic builds, tests, or deployments can be triggered on PR open/push.

5. **Review & Merge**  
   After approval and CI checks pass, squash or merge the PR into `main`.

6. **Deploy from `main`**  
   Since `main` is always stable, it can be deployed immediately or automatically.

---

## 🎯 Why Only `feature/*` and `fix/*`?

- **Simplicity**: Easier to understand and onboard new team members.
- **Speed**: Encourages smaller, more frequent changes.
- **Focus**: Avoids unnecessary branch types like `release/`, `hotfix/`, or `develop/` seen in Git Flow.
- **CI/CD Friendly**: Streamlined for automated testing and deployment pipelines.
- **Flexibility**: Optional prefixes like `refactor/` or `docs/` can still be used within the `feature/` or `fix/` namespace.

---

## ✅ Summary

| Element           | GitHub Flow                                                  |
|------------------|--------------------------------------------------------------|
| Main branch       | `main` (always deployable)                                   |
| Dev branches      | `feature/*`, `fix/*`                                         |
| Release strategy  | Continuous Deployment                                        |
| Merge method      | Pull Request → Code Review → Merge → Deploy                  |
| Suitable for      | Web dev, microservices, agile teams, fast iteration cycles   |

> ✅ Use GitHub Flow when you want **simplicity**, **speed**, and **reliability** in your development process.

