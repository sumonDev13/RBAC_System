export default function Login() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <div className="w-[400px] bg-white p-6 rounded-xl shadow">
        <h2 className="text-2xl font-bold mb-4">Login</h2>

        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Email"
        />

        <input
          className="w-full mb-4 p-2 border rounded"
          placeholder="Password"
          type="password"
        />

        <button className="w-full bg-black text-white py-2 rounded">
          Login
        </button>
      </div>
    </div>
  );
}