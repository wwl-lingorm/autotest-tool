#!/usr/bin/env python3
"""
Simple Robot Framework runner adapter.
- Runs Robot suites in a given directory
- Writes output XML and a simplified JSON summary to output_dir
Usage:
  python run_robot.py --suite-dir ../../smoke/robot --output-dir ../reports --run-id myrun123

Requires: robotframework installed in the environment:
  pip install robotframework
"""
import argparse
import json
import os
import sys
import uuid
from robot import run as robot_run
import xml.etree.ElementTree as ET


def parse_output_xml(xml_path):
    if not os.path.exists(xml_path):
        return None
    tree = ET.parse(xml_path)
    root = tree.getroot()
    tests = []
    total = 0
    passed = 0
    failed = 0
    for t in root.findall('.//test'):
        total += 1
        name = t.get('name')
        status_elem = t.find('status')
        status = status_elem.get('status') if status_elem is not None else 'UNKNOWN'
        msg = status_elem.text.strip() if (status_elem is not None and status_elem.text) else ''
        if status.upper() == 'PASS':
            passed += 1
        else:
            failed += 1
        tests.append({
            'name': name,
            'status': status,
            'message': msg
        })
    return {
        'total': total,
        'passed': passed,
        'failed': failed,
        'tests': tests
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--suite-dir', required=True, help='Path to Robot suite directory or file')
    p.add_argument('--output-dir', required=True, help='Directory to write output.xml and report json')
    p.add_argument('--run-id', required=False, help='Run identifier')
    args = p.parse_args()

    suite_dir = args.suite_dir
    output_dir = args.output_dir
    run_id = args.run_id or str(uuid.uuid4())

    os.makedirs(output_dir, exist_ok=True)
    output_xml = os.path.join(output_dir, f'output-{run_id}.xml')

    # Run Robot
    try:
        # Do not generate Robot's log/report HTML to keep CI minimal
        rc = robot_run(suite_dir, output=output_xml, log=None, report=None)
    except Exception as e:
        print('ERROR: Robot run failed:', e, file=sys.stderr)
        rc = 1

    summary = parse_output_xml(output_xml)
    report = {
        'runId': run_id,
        'return_code': rc,
        'summary': summary
    }
    json_path = os.path.join(output_dir, f'report-{run_id}.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json_path)
    # exit code: 0 if all tests passed (no failed), else 1
    if summary is None:
        sys.exit(2)
    if summary['failed'] == 0:
        sys.exit(0)
    sys.exit(1)


if __name__ == '__main__':
    main()
