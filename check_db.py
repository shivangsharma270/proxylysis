import sqlite3
import os

DB_PATH = 'proxylysis_history.db'

def check_columns():
    if not os.path.exists(DB_PATH):
        print(f"Database file {DB_PATH} not found.")
        return
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        
        # Get list of tables
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cur.fetchall()
        print("Tables in database:")
        for table in tables:
            table_name = table[0]
            print(f"\n--- Table: {table_name} ---")
            # Get columns for each table
            cur.execute(f"PRAGMA table_info({table_name})")
            columns = cur.fetchall()
            for col in columns:
                print(f"  {col[1]} ({col[2]})")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    check_columns()
