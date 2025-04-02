function useHover(el) {
  const { ref, onMounted, onUnmounted } = Vue
  const hover = ref(false)

  const handlerMouseEnter = (e) => {
    hover.value = true
  }

  const handlerMouseLeave = (e) => {
    hover.value = false
  }

  onMounted(() => {
    if (el.value) {
      el.value.addEventListener("mouseenter", handlerMouseEnter)
      el.value.addEventListener("mouseleave", handlerMouseLeave)
      onUnmounted(() => {
        el.value.removeEventListener("mouseenter", handlerMouseEnter)
        el.value.removeEventListener("mouseleave", handlerMouseLeave)
      })
    }
  })

  return { hover }
}

module.exports = useHover