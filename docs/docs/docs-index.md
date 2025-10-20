# PipeCraft Documentation Index

Welcome to PipeCraft documentation! This index helps you find the right documentation for your needs.

## 📚 Documentation Overview

PipeCraft documentation is organized into user-facing guides, contributor resources, and planning documents.

---

## 🚀 Getting Started

### For New Users
1. **[Main README](../README.md)** - Start here! Installation, quick start, and basic usage
2. **[Current Trunk Flow](./CURRENT_TRUNK_FLOW.md)** - Understand how the trunk-based workflow works
3. **[Examples](../examples/)** - Example configurations for different use cases
   - `basic-config.json` - Simple single-repo configuration
   - `monorepo-config.json` - Multi-domain monorepo configuration
   - `usage.md` - Detailed usage examples

### Quick Links
- 📦 [Installation](../README.md#installation)
- ⚡ [Quick Start](../README.md#quick-start)
- ⚙️ [Configuration Options](../README.md#configuration-options)
- 🐛 [Troubleshooting](./ERROR_HANDLING.md)

---

## 📖 User Documentation

### Core Concepts
- **[Current Trunk Flow](./CURRENT_TRUNK_FLOW.md)** - The ONE currently implemented workflow pattern
  - How promotions work (develop → staging → main)
  - Auto-merge configuration
  - Domain-based testing
  - Semantic versioning integration

- **[Architecture](./ARCHITECTURE.md)** - System design and how PipeCraft works
  - Component overview
  - Data flow diagrams
  - Design decisions explained
  - Extension points

### Guides & References
- **[Error Handling](./ERROR_HANDLING.md)** - Complete error types, causes, and solutions
  - Configuration errors
  - Pre-flight check failures
  - Git operation errors
  - GitHub API errors
  - File system errors
  - Recovery strategies

- **[AST Operations](./AST_OPERATIONS.md)** - YAML manipulation internals
  - How comment preservation works
  - Path-based operations
  - Advanced YAML AST manipulation

---

## 🛠️ Contributor Documentation

### Getting Started with Contributing
- **[Repository Cleanup Plan](./REPO_CLEANUP_PLAN.md)** - Understanding the repo structure
  - Directory organization
  - Where to add new code/tests/docs
  - File categorization

### Development Guides
- **[Architecture](./ARCHITECTURE.md)** - Required reading for contributors
  - System components in detail
  - How everything fits together
  - Performance considerations
  - Security considerations

- **[Test Documentation](../tests/README.md)** - How to run and write tests
  - Test structure and categories
  - Running tests locally
  - Writing good tests
  - Debugging test failures

- **[AST Operations](./AST_OPERATIONS.md)** - Deep dive into YAML manipulation
  - Required for working on template generation
  - Comment preservation implementation
  - Path operation implementation

### Contributing Workflow
1. Read [Architecture](./ARCHITECTURE.md) to understand the system
2. Read [Test Documentation](../tests/README.md) to understand testing
3. Pick an issue or feature to work on
4. Write tests first (TDD approach)
5. Implement the feature/fix
6. Ensure all tests pass
7. Submit pull request

---

## 🗺️ Planning & Roadmap

### Future Plans
- **[Roadmap](../TRUNK_FLOW_PLAN.md)** - Future features and enhancements
  - ⚠️ **Note**: This describes FUTURE plans, not current implementation
  - Temporary branches (planned)
  - Multiple flow patterns (planned)
  - GitLab support (planned)
  - Environment deployments (planned)

### Historical/Planning Documents
- **[User Journey Errors Planning](./USER_JOURNEY_ERRORS_PLANNING.md)** - Comprehensive error scenario planning
  - This is a planning/design document
  - Maps every possible error scenario
  - Reference for error handling implementation

---

## 📋 Document Categories

### Production Documentation (User-Facing)
| Document | Purpose | Audience |
|----------|---------|----------|
| [Main README](../README.md) | Installation, quick start, usage | All users |
| [Current Trunk Flow](./CURRENT_TRUNK_FLOW.md) | Current implementation details | Users, contributors |
| [Error Handling](./ERROR_HANDLING.md) | Troubleshooting guide | Users |
| [Examples](../examples/) | Configuration examples | Users |

### Technical Documentation (Contributor-Facing)
| Document | Purpose | Audience |
|----------|---------|----------|
| [Architecture](./ARCHITECTURE.md) | System design | Contributors |
| [AST Operations](./AST_OPERATIONS.md) | YAML manipulation internals | Advanced contributors |
| [Test Documentation](../tests/README.md) | Testing guide | Contributors |
| [Repository Cleanup Plan](./REPO_CLEANUP_PLAN.md) | Repo organization | Contributors |

### Planning Documentation (Reference)
| Document | Purpose | Audience |
|----------|---------|----------|
| [Roadmap](../TRUNK_FLOW_PLAN.md) | Future features | Product planning |
| [User Journey Errors Planning](./USER_JOURNEY_ERRORS_PLANNING.md) | Error scenario planning | Development planning |

---

## 🔍 Finding What You Need

### I want to...

**Use PipeCraft**
→ Start with [Main README](../README.md)
→ Then read [Current Trunk Flow](./CURRENT_TRUNK_FLOW.md)
→ Check [Examples](../examples/) for your use case

**Troubleshoot an error**
→ Read [Error Handling](./ERROR_HANDLING.md)
→ Search for your error message
→ Follow the recovery steps

**Understand how PipeCraft works**
→ Read [Architecture](./ARCHITECTURE.md)
→ Read [Current Trunk Flow](./CURRENT_TRUNK_FLOW.md)
→ Study [AST Operations](./AST_OPERATIONS.md) for template internals

**Contribute code**
→ Read [Architecture](./ARCHITECTURE.md) first
→ Read [Test Documentation](../tests/README.md)
→ Check [Repository Cleanup Plan](./REPO_CLEANUP_PLAN.md) for structure
→ Write tests, then code
→ Submit PR

**Add a new feature**
→ Check [Roadmap](../TRUNK_FLOW_PLAN.md) for planned features
→ Read [Architecture](./ARCHITECTURE.md) for extension points
→ Discuss in GitHub issues first
→ Follow contributor workflow above

**Write tests**
→ Read [Test Documentation](../tests/README.md)
→ Look at existing tests for examples
→ Follow test best practices documented there

---

## 📊 Documentation Status

### ✅ Complete & Up-to-Date
- Main README
- Architecture
- Current Trunk Flow
- Error Handling
- AST Operations (moved from src/utils/)
- Test Documentation
- Repository Cleanup Plan

### 🚧 Needs Creation/Update
- CHANGELOG.md (create)
- CONTRIBUTING.md (create)
- tests/CONTRIBUTING_TESTS.md (create)
- Main README (update to remove unimplemented features)

### 📋 Planning Documents
- Roadmap (marked as future)
- User Journey Errors Planning (reference)

---

## 🤝 Contributing to Documentation

Documentation is code! When contributing:

1. **Keep It Current**: Update docs when you change code
2. **Be Specific**: Use examples, code snippets, exact commands
3. **Test Your Docs**: Ensure commands work, examples run
4. **Link Liberally**: Cross-reference related docs
5. **Update This Index**: When adding new docs, add them here

### Documentation Guidelines
- Use clear, simple language
- Include code examples
- Add diagrams where helpful
- Show both the command AND expected output
- Explain "why" not just "what"
- Keep file sizes reasonable (< 500 lines per doc)

### Where to Put New Documentation
- **User guides**: `/docs/` directory
- **API docs**: JSDoc comments in code
- **Test docs**: `/tests/` directory
- **Planning docs**: `/docs/` with clear "PLANNING" or "ROADMAP" marker
- **Examples**: `/examples/` directory

---

## 📞 Getting Help

If you can't find what you need:

1. **Search this index** for keywords
2. **Check [Main README](../README.md)** for quick answers
3. **Search GitHub issues** for similar questions
4. **Ask in GitHub Discussions**
5. **Create a new issue** with the "documentation" label

---

## 🔄 Recently Updated

- 2025-01-19: Created documentation index
- 2025-01-19: Moved AST operations docs from src/utils/
- 2025-01-19: Created ARCHITECTURE.md
- 2025-01-19: Created CURRENT_TRUNK_FLOW.md
- 2025-01-19: Created ERROR_HANDLING.md
- 2025-01-19: Updated TRUNK_FLOW_PLAN.md to mark as future roadmap

---

## 📜 License

All documentation is licensed under the same license as PipeCraft (see [LICENSE](../LICENSE)).

---

**Happy building! 🚀**

