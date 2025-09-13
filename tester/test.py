import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import requests
import json

class ApiTesterApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Escape Room API Tester")
        self.geometry("800x650")
        self.configure(bg="#2E2E2E")

        # --- Style Configuration ---
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure("TFrame", background="#2E2E2E")
        style.configure("TLabel", background="#2E2E2E", foreground="#FFFFFF", font=("Helvetica", 10))
        style.configure("TButton", background="#4A90E2", foreground="#FFFFFF", font=("Helvetica", 10, "bold"), borderwidth=0)
        style.map("TButton", background=[('active', '#357ABD')])
        style.configure("TEntry", fieldbackground="#3C3C3C", foreground="#FFFFFF", insertbackground="#FFFFFF", borderwidth=1)
        style.configure("TNotebook", background="#2E2E2E", borderwidth=0)
        style.configure("TNotebook.Tab", background="#3C3C3C", foreground="#FFFFFF", padding=[10, 5])
        style.map("TNotebook.Tab", background=[("selected", "#4A90E2")], foreground=[("selected", "#FFFFFF")])

        # --- Main Layout ---
        main_frame = ttk.Frame(self, padding="10")
        main_frame.pack(expand=True, fill="both")

        # --- Top: Configuration Frame ---
        config_frame = ttk.Frame(main_frame)
        config_frame.pack(fill="x", pady=(0, 10))
        config_frame.columnconfigure(1, weight=1)
        config_frame.columnconfigure(3, weight=1)

        ttk.Label(config_frame, text="Base URL:").grid(row=0, column=0, padx=(0, 5), sticky="w")
        self.base_url_entry = ttk.Entry(config_frame, width=40)
        self.base_url_entry.insert(0, "http://localhost:3000")
        self.base_url_entry.grid(row=0, column=1, sticky="ew")

        ttk.Label(config_frame, text="Room ID:").grid(row=0, column=2, padx=(10, 5), sticky="w")
        self.room_id_entry = ttk.Entry(config_frame, width=20)
        self.room_id_entry.insert(0, "V7as_cLh2m8UX2EIrRCjh")
        self.room_id_entry.grid(row=0, column=3, sticky="ew")

        # --- Middle: Actions and Response ---
        paned_window = tk.PanedWindow(main_frame, orient=tk.HORIZONTAL, bg="#2E2E2E", sashwidth=8)
        paned_window.pack(expand=True, fill="both")

        # --- Left Side: Actions Notebook ---
        self.notebook = ttk.Notebook(paned_window)
        paned_window.add(self.notebook, width=350)

        self.create_get_all_tab()
        self.create_update_tab()
        self.create_create_tab()

        # --- Right Side: Response Area ---
        response_frame = ttk.Frame(paned_window)
        paned_window.add(response_frame)

        ttk.Label(response_frame, text="API Response", font=("Helvetica", 12, "bold")).pack(anchor="w", pady=(0, 5))
        self.response_text = scrolledtext.ScrolledText(response_frame, wrap=tk.WORD, height=10, width=50,
                                                       bg="#1E1E1E", fg="#D4D4D4", insertbackground="#FFFFFF",
                                                       font=("Courier New", 10), borderwidth=0)
        self.response_text.pack(expand=True, fill="both")


    def create_tab_frame(self, tab_name):
        frame = ttk.Frame(self.notebook, padding="15")
        self.notebook.add(frame, text=tab_name)
        return frame

    def create_get_all_tab(self):
        tab = self.create_tab_frame("Get All")
        ttk.Label(tab, text="Retrieve all variables for the room.", wraplength=300).pack(anchor="w", pady=(0, 15))
        ttk.Button(tab, text="GET All Variables", command=self.get_all_variables).pack(fill="x")

    def create_update_tab(self):
        tab = self.create_tab_frame("Update")
        ttk.Label(tab, text="Update a specific variable's value.").pack(anchor="w", pady=(0, 10))

        ttk.Label(tab, text="Variable Name:").pack(anchor="w")
        self.update_name_entry = ttk.Entry(tab)
        self.update_name_entry.pack(fill="x", pady=(0, 10))

        ttk.Label(tab, text="New Value: (e.g., 15, true, some_string)").pack(anchor="w")
        self.update_value_entry = ttk.Entry(tab)
        self.update_value_entry.pack(fill="x", pady=(0, 15))

        ttk.Button(tab, text="POST Update", command=self.update_variable).pack(fill="x")

    def create_create_tab(self):
        tab = self.create_tab_frame("Create")
        ttk.Label(tab, text="Create a new variable in the room.").pack(anchor="w", pady=(0, 10))

        ttk.Label(tab, text="Variable Name:").pack(anchor="w")
        self.create_name_entry = ttk.Entry(tab)
        self.create_name_entry.pack(fill="x", pady=(0, 10))

        ttk.Label(tab, text="Type: (e.g., boolean, string, number)").pack(anchor="w")
        self.create_type_entry = ttk.Entry(tab)
        self.create_type_entry.pack(fill="x", pady=(0, 10))
        
        ttk.Label(tab, text="Initial Value:").pack(anchor="w")
        self.create_value_entry = ttk.Entry(tab)
        self.create_value_entry.pack(fill="x", pady=(0, 15))

        ttk.Button(tab, text="POST Create", command=self.create_variable).pack(fill="x")

    def _convert_value(self, value_str):
        """Intelligently converts a string to bool, int, float, or keeps it as a string."""
        val_lower = value_str.lower()
        if val_lower == 'true':
            return True
        if val_lower == 'false':
            return False
        try:
            return int(value_str)
        except ValueError:
            try:
                return float(value_str)
            except ValueError:
                return value_str # Return original string if all conversions fail

    def make_request(self, method, url, payload=None):
        self.response_text.delete('1.0', tk.END)
        self.response_text.insert('1.0', f"Sending {method} request to:\n{url}\n\n")
        if payload:
            self.response_text.insert(tk.END, f"Payload:\n{json.dumps(payload, indent=2)}\n\n")
        self.update_idletasks()

        try:
            headers = {"Content-Type": "application/json"}
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=5)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=5)
            else:
                raise ValueError(f"Unsupported method '{method}'")

            response.raise_for_status()

            self.response_text.insert(tk.END, f"--- SUCCESS (Status: {response.status_code}) ---\n")
            try:
                response_json = response.json()
                self.response_text.insert(tk.END, json.dumps(response_json, indent=2))
            except json.JSONDecodeError:
                self.response_text.insert(tk.END, response.text)

        except requests.exceptions.RequestException as e:
            self.response_text.insert(tk.END, f"--- ERROR ---\n{e}")
            messagebox.showerror("Request Error", str(e))
        except Exception as e:
            self.response_text.insert(tk.END, f"--- UNEXPECTED ERROR ---\n{e}")
            messagebox.showerror("Unexpected Error", str(e))

    def get_all_variables(self):
        base_url = self.base_url_entry.get().strip()
        room_id = self.room_id_entry.get().strip()
        if not base_url or not room_id:
            messagebox.showwarning("Input Missing", "Please provide both Base URL and Room ID.")
            return
        url = f"{base_url}/api/rooms/{room_id}/variables"
        self.make_request('GET', url)

    def update_variable(self):
        base_url = self.base_url_entry.get().strip()
        room_id = self.room_id_entry.get().strip()
        variable_name = self.update_name_entry.get().strip()
        value = self.update_value_entry.get().strip()

        if not all([base_url, room_id, variable_name]):
            messagebox.showwarning("Input Missing", "Please provide Base URL, Room ID, and Variable Name.")
            return

        payload = {"value": self._convert_value(value)}
        url = f"{base_url}/api/rooms/{room_id}/variables/{variable_name}"
        self.make_request('POST', url, payload)

    def create_variable(self):
        base_url = self.base_url_entry.get().strip()
        room_id = self.room_id_entry.get().strip()
        name = self.create_name_entry.get().strip()
        var_type = self.create_type_entry.get().strip()
        value = self.create_value_entry.get().strip()

        if not all([base_url, room_id, name, var_type]):
             messagebox.showwarning("Input Missing", "Please fill in all fields to create a variable.")
             return

        payload = {
            "name": name,
            "type": var_type,
            "value": self._convert_value(value)
        }
        url = f"{base_url}/api/rooms/{room_id}/variables"
        self.make_request('POST', url, payload)

if __name__ == "__main__":
    app = ApiTesterApp()
    app.mainloop()
