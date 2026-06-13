import { useNavigate } from 'react-router-dom';
export default function NotFoundPage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-4xl">404</div>
      <div className="text-gray-500 text-sm">Page not found</div>
      <button onClick={() => nav('/inbox')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Go to inbox</button>
    </div>
  );
}
