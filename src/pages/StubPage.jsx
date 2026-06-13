import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
export default function StubPage({ title, phase, description }) {
  const navigate = useNavigate();
  return (
    <Layout title={title}>
      <div className="flex flex-col items-center justify-center min-h-96 px-8 text-center">
        <div className="text-4xl mb-4">🔨</div>
        <div className="text-sm font-medium text-gray-800 mb-2">{title}</div>
        <div className="text-xs text-gray-500 mb-4 max-w-xs">{description}</div>
        <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full mb-6">{phase}</span>
        <button onClick={() => navigate('/inbox')} className="text-blue-600 text-sm border border-blue-200 px-4 py-2 rounded-lg">
          Back to inbox
        </button>
      </div>
    </Layout>
  );
}
