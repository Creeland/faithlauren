export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-stone-200 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-stone-200 p-6 h-24 rounded"
          >
            <div className="h-8 w-16 bg-stone-200 rounded mb-2" />
            <div className="h-4 w-24 bg-stone-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
