import wxauto4
import inspect

print("wxauto4 Version:", getattr(wxauto4, "__version__", "unknown"))

# Inspect WeChat class methods
print("\nMethods in WeChat:")
for name, member in inspect.getmembers(wxauto4.WeChat, predicate=inspect.isfunction):
    print(f"  - {name}")
