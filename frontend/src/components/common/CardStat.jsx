import StatCard from './ui/StatCard';

export default function CardStat({ icon, label, value, accent = 'sena-green' }) {
  const mapAccent = {
    'sena-green': 'green',
    yellow: 'yellow',
    blue: 'blue',
    red: 'red',
  };
  return <StatCard icon={icon} label={label} value={value} accent={mapAccent[accent] || 'green'} />;
}