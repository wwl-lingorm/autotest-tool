QTest smoke placeholder

Place a compiled QTest executable into this directory (e.g. mytest.exe) and run:

```powershell
python ..\..\scripts\run_qtest.py --bin ./mytest.exe --output-dir ../../reports --run-id smoke-qtest-001
```

The script will capture stdout/stderr and write `report-<runId>.json` into `backend/reports/`.
