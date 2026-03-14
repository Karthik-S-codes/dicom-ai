function StatusBadge({ status }) {
  const normalized = (status || 'PENDING').toUpperCase();
  const className =
    normalized === 'SUCCESS'
      ? 'status-badge success'
      : normalized === 'WARNING' || normalized.includes('RISK') || normalized === 'UNSTABLE'
        ? 'status-badge warning'
        : normalized === 'FAILED'
          ? 'status-badge failure'
          : 'status-badge neutral';

  return <span className={className}>{normalized}</span>;
}

export default StatusBadge;
