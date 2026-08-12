# Contribution Guide

Welcome to contribute to PacketScope! Please take a few minutes to read this guide before submitting issues or pull requests.

## Development Environment

### Prerequisites

| Tool | Version | Used By |
|------|---------|---------|
| Go | >= 1.25 | Analyzer (Monitor, Calculator), Guarder |
| Python | >= 3.10 | Tracer, MCP Skills |
| Docker | >= 20.10 | All modules |
| Linux Kernel | >= 6.8 | Analyzer (eBPF fentry/bpf2go) |
| Linux Kernel | >= 5.4 | Guarder (XDP) |

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Internet-Architecture-and-Security/PacketScope.git
   cd PacketScope
   ```

2. Start services with Docker:
   ```bash
   docker compose up --build
   ```

3. For individual module development, see each module's README:
   - [Analyzer (Monitor + Calculator)](modules/Analyzer/README.md)
   - [Tracer](modules/Tracer/README.md)
   - [Guarder](modules/Guarder/README.md)

## Contribution Process

1. **Fork** the project

2. **Create your branch**
   ```bash
   git checkout -b feature/AmazingFeature
   ```

   Branch naming conventions:
   - `feature/` — New feature
   - `fix/` — Bug fix
   - `docs/` — Documentation update

   See [GitHub Flow](./.github/GITHUB_FLOW.md) for details.

3. **Commit your changes**
   ```bash
   git commit -m 'feat(scope): short description'
   ```

   Commit message format (Conventional Commits):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation update
   - `style:` Code formatting
   - `refactor:` Code refactoring
   - `test:` Test related
   - `chore:` Build process or tooling changes

   See [Git Commit Specification](./.github/GITCOMMIT.md) for details.

4. **Push to the branch**
   ```bash
   git push origin feature/AmazingFeature
   ```

5. **Submit Pull Request**
   - Provide clear title and description
   - Link related issues (if any)

## Code Standards

### Go (Analyzer, Guarder)

- Follow [Effective Go](https://go.dev/doc/effective_go) guidelines
- Run `gofmt` before committing
- Use `go vet` and `golangci-lint`
- eBPF code: use `bpf2go` for C-to-Go compilation
- Error handling: always check errors, wrap with context using `fmt.Errorf("...: %w", err)`

### Python (Tracer, Skills)

- Follow [PEP 8](https://peps.python.org/pep-0008/) style guide
- Use type hints for function signatures
- Dependencies: list in `requirements.txt`
- MCP servers: use `FastMCP` framework

### eBPF

- Use BTF-enabled kernel (6.8+ for fentry)
- Prefer `bpf2go` (Go) or `BCC` (Python, legacy only)
- Test with `bpftool` before integration

### Frontend (React + TypeScript + Vite)

- Follow existing project structure under `src/`
- Use TypeScript strict mode
- Run `npm run lint` before committing

## Testing

- Go modules: `go test ./...`
- Python modules: `pytest` or module-specific test scripts
- MCP Skills: see `skills/*/test/` directories
- Integration: use Docker Compose to test full stack

## Code of Conduct

We have a [Code of Conduct](./CODE_OF_CONDUCT.md) that we expect all contributors to follow.

## Getting Help

- Review project documentation in each module's `README.md`
- Search existing [Issues](https://github.com/Internet-Architecture-and-Security/PacketScope/issues)
- Ask questions in [Discussions](https://github.com/Internet-Architecture-and-Security/PacketScope/discussions)

Thank you for your contribution!
