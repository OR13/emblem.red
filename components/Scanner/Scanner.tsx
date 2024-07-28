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
      <video id="reel" ref={ref} />
      <img className="overlay" alt={"scan indicator"} src="/target.png" />
    </div>
  )
}

export default Scanner