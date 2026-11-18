import logo from '../assets/brand.svg';

export default function Brand() {
  return <div className="brand"><img src={logo} alt="" width="40" height="40" />
    <span>Bosque Claro<small>Personas & bienestar</small></span>
  </div>;
}
