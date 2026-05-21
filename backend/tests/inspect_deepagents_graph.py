import os
import sys

# Print graph.py inside deepagents package to see how it invokes model and processes messages
def main():
    import deepagents.graph as dag
    import inspect
    
    print("--- deepagents.graph source path ---")
    print(dag.__file__)
    
    print("\n--- Listing functions in deepagents.graph ---")
    for name, obj in inspect.getmembers(dag, inspect.isfunction):
        print(f"Function: {name}")
        
    print("\n--- Listing classes in deepagents.graph ---")
    for name, obj in inspect.getmembers(dag, inspect.isclass):
        print(f"Class: {name}")

if __name__ == "__main__":
    main()
