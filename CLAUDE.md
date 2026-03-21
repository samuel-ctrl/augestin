# CLAUDE.md

## Shared UI Sync

When making any changes to the parent `shared-ui/` library, you MUST delete and re-copy it into both portals:

```bash
rm -rf tutor-portal/shared-ui && cp -r shared-ui tutor-portal/shared-ui
rm -rf student-portal/shared-ui && cp -r shared-ui student-portal/shared-ui
```

The portals use local copies of shared-ui (not npm links), so changes won't take effect until you sync.
