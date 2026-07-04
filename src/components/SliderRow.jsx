export default function SliderRow({ dim, value, onChange }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs font-semibold text-stone-500 mb-1 tracking-wide">
        <span>{dim.left}</span>
        <span>{dim.right}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(dim.key, Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-orange-100 accent-orange-500 cursor-pointer"
      />
    </div>
  );
}
