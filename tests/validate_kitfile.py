#!/usr/bin/env python3
"""
KitOps Policy Tests
Validates Kitfile structure before building ModelKits.
"""

import json
import sys
from pathlib import Path

import yaml


def check_required_fields(kitfile: dict) -> list[str]:
    """Check required Kitfile fields."""
    errors = []

    if not kitfile.get("manifestVersion"):
        errors.append("Missing: manifestVersion")

    pkg = kitfile.get("package", {})
    if not pkg.get("name"):
        errors.append("Missing: package.name")
    if not pkg.get("version"):
        errors.append("Missing: package.version")

    model = kitfile.get("model", {})
    if not model.get("name"):
        errors.append("Missing: model.name")
    if not model.get("path"):
        errors.append("Missing: model.path")

    return errors


def check_best_practices(kitfile: dict) -> list[str]:
    """Check best practice recommendations."""
    warnings = []

    pkg = kitfile.get("package", {})
    if not pkg.get("description"):
        warnings.append("Recommendation: Add package.description")
    if not pkg.get("license"):
        warnings.append("Recommendation: Add package.license (e.g., Apache-2.0)")
    if not pkg.get("authors"):
        warnings.append("Recommendation: Add package.authors list")

    model = kitfile.get("model", {})
    if not model.get("framework"):
        warnings.append("Recommendation: Add model.framework (e.g., xgboost, pytorch)")
    if not model.get("license"):
        warnings.append("Recommendation: Add model.license")

    return warnings


def validate_kitfile(path: str) -> bool:
    """Validate a single Kitfile and print results."""
    print(f"\n📄 Validating: {path}")
    print("-" * 50)

    try:
        with open(path) as f:
            kitfile = yaml.safe_load(f)
    except Exception as e:
        print(f"❌ YAML parse error: {e}")
        return False

    errors = check_required_fields(kitfile)
    warnings = check_best_practices(kitfile)

    if errors:
        for e in errors:
            print(f"  ❌ {e}")
    else:
        print("  ✅ All required fields present")

    for w in warnings:
        print(f"  ⚠️  {w}")

    # Print summary fields
    pkg = kitfile.get("package", {})
    model = kitfile.get("model", {})
    print(f"\n  Name      : {pkg.get('name', 'N/A')}")
    print(f"  Version   : {pkg.get('version', 'N/A')}")
    print(f"  Framework : {model.get('framework', 'N/A')}")
    print(f"  Datasets  : {len(kitfile.get('datasets', []))}")

    return len(errors) == 0


def main():
    # Find all Kitfiles in the project
    kitfiles_dir = Path(__file__).parent.parent / "kitfiles"
    kitfile_paths = list(kitfiles_dir.glob("*.yaml")) + list(kitfiles_dir.glob("*.yml"))

    if not kitfile_paths:
        print("No Kitfiles found in kitfiles/")
        sys.exit(0)

    print("=" * 60)
    print("  KitOps MLOps Suite — Kitfile Validation")
    print("=" * 60)

    all_passed = True
    for path in kitfile_paths:
        if not validate_kitfile(str(path)):
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("  ✅ All Kitfiles are valid!")
    else:
        print("  ❌ Some Kitfiles have validation errors.")
        sys.exit(1)


if __name__ == "__main__":
    main()
