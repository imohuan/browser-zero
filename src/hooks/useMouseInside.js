function useMouseInside(getRect) {
  const { ref, onUnmounted } = Vue
  const inside = ref(false)
  const handler = (e) => {
    const x = e.clientX
    const y = e.clientY
    const [x1, y1, w, h] = getRect()
    inside.value = x > x1 && x < x1 + w && y > y1 && y < y1 + h
  }
  document.addEventListener("mousemove", handler)
  onUnmounted(() => document.removeEventListener("mousemove", handler))
  return { inside }
}
module.exports = useMouseInside