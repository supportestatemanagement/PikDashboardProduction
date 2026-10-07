export default function SulapProgramCredit({ showText = true }) {
  return <span className="ppb-sulap-credit">
    <img src={`${process.env.PUBLIC_URL || ''}/asg-untuk-indonesia.jpg`} alt="ASG untuk Indonesia" width="180" height="65" />
    {showText && <span>Program SULAP by CSR PIK</span>}
  </span>;
}
