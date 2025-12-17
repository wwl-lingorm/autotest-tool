#!/usr/bin/env python3
"""
Simple QTest runner adapter.
- Executes a QTest-built binary (or any executable) and captures stdout/stderr.
- If the test binary emits XML (QTest uses XML output via -o or QtTestLib options), this script will try to parse it; otherwise it will summarize stdout/stderr.
- Writes a simplified JSON report: runId, return_code, summary (total/passed/failed) and raw logs path.

Usage:
  python run_qtest.py --bin ./build/mytest.exe --output-dir ../reports --run-id qtest-001

Notes:
- This script requires Python 3.8+.
"""
import argparse
import json
import os
import subprocess
import sys
import uuid
import tempfile
from datetime import datetime


def try_parse_qtest_xml(xml_path):
    # Minimal parser placeholder — QTest XML schema can vary; implement as needed
    if not os.path.exists(xml_path):
        return None
    try:
        import xml.etree.ElementTree as ET
        tree = ET.parse(xml_path)
        root = tree.getroot()
        tests = []
        total = 0
        passed = 0
        failed = 0
        for t in root.findall('.//TestCase'):
            total += 1
            name = t.get('name') or t.get('Name') or 'unnamed'
            status = t.find('Result').text if t.find('Result') is not None else 'UNKNOWN'
            if status.lower() == 'pass':
                passed += 1
            else:
                failed += 1
            tests.append({'name': name, 'status': status})
        return {'total': total, 'passed': passed, 'failed': failed, 'tests': tests}
    except Exception:
        return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--bin', required=True, help='Path to qtest binary executable')
    p.add_argument('--output-dir', required=True, help='Directory to write reports and logs')
    p.add_argument('--run-id', required=False, help='Run identifier')
    p.add_argument('--xml-output', required=False, help='Optional path where binary writes XML output')
    args = p.parse_args()

    bin_path = args.bin
    output_dir = args.output_dir
    run_id = args.run_id or str(uuid.uuid4())
    xml_out = args.xml_output

    os.makedirs(output_dir, exist_ok=True)
    log_path = os.path.join(output_dir, f'log-{run_id}.txt')

    with open(log_path, 'wb') as logf:
        try:
            proc = subprocess.Popen([bin_path], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            out, _ = proc.communicate()
            logf.write(out or b'')
            rc = proc.returncode
        except Exception as e:
            msg = f'ERROR launching binary: {e}\n'.encode('utf-8')
            logf.write(msg)
            rc = 2

    summary = None
    if xml_out:
        summary = try_parse_qtest_xml(xml_out)
    if summary is None:
        # fallback: simple heuristics from stdout
        try:
            text = out.decode('utf-8', errors='ignore') if out else ''
        except Exception:
            text = ''
        passed = 0
        failed = 0
        total = 0
        # Heuristic: look for lines like 'PASS'/'FAIL' in output
        for line in text.splitlines():
            if 'PASS' in line and 'TEST' in line.upper():
                passed += 1
                total += 1
            elif 'FAIL' in line and 'TEST' in line.upper():
                failed += 1
                total += 1
        summary = {'total': total, 'passed': passed, 'failed': failed, 'raw': text[:2000]}

    report = {
        'runId': run_id,
        'return_code': rc,
        'summary': summary,
        'log': os.path.relpath(log_path)
    }
    json_path = os.path.join(output_dir, f'report-{run_id}.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json_path)
    if summary and summary.get('failed', 0) == 0:
        sys.exit(0)
    sys.exit(1)


if __name__ == '__main__':
    main()
