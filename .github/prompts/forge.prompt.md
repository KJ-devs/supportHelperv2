---
description: "Launch full Forge orchestration — analyzes your request, plans tasks, and delegates to the right specialized agents"
agent: forge
---

Analyze the user's request and execute the full Forge orchestration pipeline:

1. **Decompose** the request into atomic tasks
2. **Identify** which agents are needed (backend-dev, frontend-dev, dba, etc.)
3. **Plan** the execution order based on dependencies
4. **Delegate** each task to the appropriate agent
5. **Review** each result before moving to the next task
6. **Deliver** the assembled result

Show progress using this format:

```
🏗️ FORGE — [Feature Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Progress: X/Y tasks
👥 Agents: [list of agents involved]
🔗 Dependencies: [execution order]
```

User request: ${input}
