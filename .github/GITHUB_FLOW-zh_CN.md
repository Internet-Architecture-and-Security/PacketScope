# GitHub Flow 工作流程

GitHub Flow 是一种 **轻量级的 Git 分支工作流**，强调持续集成（CI）和持续部署（CD），适用于 Web 开发、敏捷项目、快速迭代场景。

---

## ✅ 分支结构

> **核心理念**：“主分支始终可部署，所有开发通过 Pull Request 合并”  
> 它追求的是简单、快速、高效的开发协作流程，特别适合现代前端/后端项目团队。

GitHub Flow 通常只需要两个核心分支：

- **`main`（或 `master`）**：主分支，**始终保持可部署状态**，用于生产环境或预发布部署，受保护控制。
- **`feature/*` 或 `fix/*`**：临时开发分支，用于功能开发或问题修复，完成后通过 Pull Request（PR）合并回 `main`，经过 CI 测试与代码审查。

> 💡 GitHub Flow 不使用 `develop`、`release`、`hotfix` 等传统中间分支，避免复杂合并流程，便于 CI/CD 持续交付。

### 🎯 为什么通常只使用 `feature/*` 和 `fix/*`

| 分支类型     | 能力范围说明                                           |
|--------------|--------------------------------------------------------|
| `feature/*`  | 用于所有**新功能开发**，包括页面、组件、模块、性能优化等 |
| `fix/*`      | 用于所有**Bug 修复**、**线上问题**、**小缺陷调整**等     |

这两类分支已涵盖 80% 以上的日常开发需求。  
保持命名规范、精简，有助于团队协作、自动化测试和 CI/CD 工作流的统一识别。

### 🧩 可选扩展：增强分支语义性

虽然 GitHub Flow 核心只包含 `feature/` 与 `fix/`，但也可以根据实际需求引入其他前缀，提升协作效率与语义清晰度：

| 类型         | 用途说明           | 示例                            |
|--------------|--------------------|---------------------------------|
| `docs/`      | 文档更新           | `docs/update-readme`            |
| `chore/`     | 构建/配置/依赖管理 | `chore/upgrade-webpack`         |
| `test/`      | 添加或修改测试代码 | `test/add-login-tests`          |
| `refactor/`  | 重构，不涉及逻辑改动 | `refactor/user-service`         |

> ✅ **原则：所有分支都从 `main` 分出，并最终通过 Pull Request 合并回 `main`，保持主分支稳定、可部署。**

---

## 🔁 工作流程

### 1. 从 `main` 创建新分支

每新增一个功能或修复一个 bug，就从 `main` 创建一个新分支：

```bash
git checkout main
git pull
git checkout -b feature/模块名-功能描述
```

示例：

```bash
git checkout -b feature/user-login
```

---

### 2. 在分支上进行开发并提交代码

保持小步提交，利于审查与回滚：

```bash
git add .
git commit -m "Add login form to header"
```

---

### 3. 推送分支到 GitHub

```bash
git push origin feature/user-login
```

---

### 4. 提交 Pull Request（PR）

在 GitHub 上创建 PR，发起合并请求，将你的分支合并回 `main`。

PR 是协作的核心步骤，可进行：

- 自动化测试（CI）
- 代码审查与讨论
- 评论建议与改进

---

### 5. 审查与合并代码

确保：

- 所有测试通过
- 审查通过
- 无合并冲突

之后可选择使用：

- `Squash and merge`（推荐，保持提交历史整洁）
- `Rebase and merge`
- `Merge commit`

---

### 6. 合并后部署（可选）

项目配置好 CI/CD 后，合并即部署，可实现：

- 自动化打包构建
- 发布到测试或生产环境
- 通知系统/团队成员等

---

## ✅ 适用场景

- 快速迭代、敏捷开发
- 持续集成与持续部署（CI/CD）已配置
- 项目版本维护不复杂
- 团队协作以 PR 为核心

---

## 🚫 不适用场景

- 多版本并行开发与维护
- 有严格发布周期与计划（推荐使用 [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)）

---

## 📌 总结

| 特性         | GitHub Flow                                |
|--------------|---------------------------------------------|
| 分支模型     | 简洁：主分支 + 功能/修复分支               |
| 代码审查     | 通过 Pull Request                           |
| 自动测试     | 每次 PR 或合并都触发                        |
| 自动部署     | 合并后可自动部署                            |
| 适用场景     | 快速迭代、持续部署、现代 Web 项目            |
