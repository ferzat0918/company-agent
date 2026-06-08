import sys
sys.path.insert(0, 'backend')
from src.skills_loader import validate_skills, list_skills

errors = validate_skills()
skills = list_skills()

print("=== Skill Validation ===")
if errors:
    for e in errors:
        print(f"  ERROR: {e}")
else:
    print("  All skills passed validation!")

print(f"\n=== {len(skills)} Skills Found ===")
for s in skills:
    dept = s["department"]
    name = s["name"]
    desc = s["description"][:80]
    print(f"  [{dept}] {name}: {desc}")
