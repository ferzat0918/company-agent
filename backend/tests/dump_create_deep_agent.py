import os
import sys

def main():
    import deepagents.graph as dag
    import inspect
    
    print("--- Source of create_deep_agent ---")
    print(inspect.getsource(dag.create_deep_agent))

if __name__ == "__main__":
    main()
