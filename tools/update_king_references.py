#!/usr/bin/env python3
import argparse
import json
from reference_catalog import run

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    print(json.dumps(run('king-legacy', write=args.write), ensure_ascii=False))
