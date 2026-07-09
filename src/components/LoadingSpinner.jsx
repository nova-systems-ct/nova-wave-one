export default function LoadingSpinner({ size = 20 }) {
  return (
    <div
      style={{
        width: size, height: size,
        border: '2px solid rgba(200,169,110,0.2)',
        borderTopColor: '#C8A96E',
        borderRadius: '50%',
        animation: 'nwSpin 0.8s linear infinite',
      }}
    >
      <style>{`@keyframes nwSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
