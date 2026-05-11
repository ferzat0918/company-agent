"""Skill directory loading configuration"""
import os
import glob
import yaml

SKILLS_DIR = os.getenv("SKILLS_DIR", "skills")

def get_skills_config():
    return [SKILLS_DIR]

def list_skills():
    """List all available skills and their frontmatter metadata."""
    skills = []
    skills_path = os.path.join(SKILLS_DIR, "*", "SKILL.md")
    for skill_file in sorted(glob.glob(skills_path)):
        with open(skill_file, "r", encoding="utf-8") as f:
            content = f.read()
        # Parse YAML frontmatter
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                meta = yaml.safe_load(parts[1])
                skills.append({
                    "name": meta.get("name", "unknown"),
                    "description": meta.get("description", ""),
                    "department": meta.get("department", ""),
                    "path": os.path.dirname(skill_file),
                })
            except yaml.YAMLError:
                pass
    return skills

def validate_skills() -> list[str]:
    """Validate all SKILL.md files have required frontmatter. Returns list of errors."""
    errors = []
    for skill_file in glob.glob(os.path.join(SKILLS_DIR, "*", "SKILL.md")):
        with open(skill_file, "r", encoding="utf-8") as f:
            content = f.read()
        parts = content.split("---", 2)
        if len(parts) < 3:
            errors.append(f"{skill_file}: missing YAML frontmatter")
            continue
        try:
            meta = yaml.safe_load(parts[1]) or {}
        except yaml.YAMLError as e:
            errors.append(f"{skill_file}: invalid YAML — {e}")
            continue
        for field in ("name", "description", "department"):
            if field not in meta:
                errors.append(f"{skill_file}: missing required frontmatter field '{field}'")
    return errors
