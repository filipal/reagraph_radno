declare module 'vanta/dist/vanta.net.min' {
  interface VantaInstance { destroy(): void }
  function NET(options: Record<string, any>): VantaInstance
  export default NET
}