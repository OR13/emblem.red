/* eslint-disable @next/next/no-img-element */
import { useZxing } from 'react-zxing'



const Scanner = ({ onScan }: any) => {
  const { ref } = useZxing({
    onDecodeResult(result: any) {
      onScan(result.getText())
    },
  })
  return (
    <div id="wrapper">
      <video id="reel" ref={ref} style={{ width: '100%' }} />
      <img className="overlay" alt={"scan indicator"} src="/raptor.png" />
    </div>
  )
}

export default Scanner