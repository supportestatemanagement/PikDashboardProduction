export default function SulapProgramCredit() {
  return <span className="ppb-sulap-credit">
    <img src={`${process.env.PUBLIC_URL || ''}/asg-untuk-indonesia.jpg`} alt="ASG untuk Indonesia" width="180" height="65" />
    <span>Program SULAP by CSR PIK</span>
  </span>;
}
