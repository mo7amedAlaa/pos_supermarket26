export default function SkeletonRows({ columns, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="skeleton-row">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c}>
              <div className="skeleton-bar" style={{ animationDelay: `${(r * columns + c) * 0.03}s` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
