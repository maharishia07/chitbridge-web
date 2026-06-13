// src/pages/ChitDetailPage.jsx — stub for now
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
export default function ChitDetailPage() {
  const { chitId } = useParams();
  return <Layout title="Chit Detail"><div className="p-4 text-sm text-gray-500">Chit {chitId} — full detail coming next session</div></Layout>;
}
