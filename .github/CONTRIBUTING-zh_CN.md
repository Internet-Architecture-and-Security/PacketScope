# 项目贡献指南

欢迎参与本项目！以下是详细的贡献指南，请你在提 issue 或者 pull request 之前花几分钟来阅读一遍这篇指南。

## 贡献流程

1. Fork 本项目

   - 点击 GitHub 页面右上角的 "Fork" 按钮
   - 这会在你的 GitHub 账户下创建项目的副本

2. 创建你的分支

   ```bash
   git checkout -b feature/AmazingFeature
   ```

   分支命名建议：

   - feature/ 新功能
   - bugfix/ 问题修复
   - hotfix/ 紧急修复
   - docs/ 文档更新

   详情参考 [gitflow](./GITHUB_FLOW-zh_CN.md)

3. 提交你的修改

   ```bash
   git commit -m '类型(范围): 简短描述'
   ```

   提交信息格式：

   - feat: 新功能
   - fix: 修复bug
   - docs: 文档更新
   - style: 代码格式
   - refactor: 代码重构
   - test: 测试相关
   - chore: 构建过程或辅助工具变动

   详情参考 [git commit 规范](./GITCOMMIT.md)

4. 推送到分支

   ```bash
   git push origin feature/AmazingFeature
   ```

5. 提交 Pull Request
   - 在 GitHub 上创建 Pull Request
   - 填写清晰的标题和描述
   - 关联相关 issue（如果有）

## 代码规范

### 通用规范

- 遵循项目现有的代码风格
- 使用有意义的变量名和函数名
- 保持代码简洁易读
- 添加必要的注释

### 语言特定规范

// ... 根据项目使用的编程语言添加具体规范 ...

### 提交规范

- 提交信息使用英文
- 遵循 Conventional Commits 规范
- 示例：
  - `feat(api): add user authentication endpoint`
  - `fix(login): handle null pointer exception`
  - `docs(readme): update installation instructions`

## 开发流程

// ... 详细说明如何设置开发环境 ...

## 行为准则

我们有一份 [行为准则](./CODE_OF_CONDUCT.md)，希望所有的贡献者都能遵守，请花时间阅读一遍全文以确保你能明白哪些是可以做的，哪些是不可以做的。

## 获取帮助

如果有任何问题，可以通过以下方式获取帮助：

- 查看项目文档
- 在 Issues 中搜索相关问题
- 在 Discussions 中提问
- 联系项目维护者

感谢您的 ❤️ 贡献！您的参与对项目发展至关重要。
