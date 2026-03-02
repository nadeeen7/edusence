import { useState } from "react";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Email:", email);
        console.log("Password:", password);
    };

    return (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
            <h2>Teacher Login</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <input
                        type="email"
                        placeholder="Enter email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ padding: "10px", margin: "10px" }}
                    />
                </div>

                <div>
                    <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ padding: "10px", margin: "10px" }}
                    />
                </div>

                <button type="submit" style={{ padding: "10px 20px" }}>
                    Login
                </button>
            </form>
        </div>
    );
}

export default Login;