import { useId } from "react";

// Original vector concept art: local, offline-capable, and never presented as model output.
export function Scenery({ scene = "dunes", className = "" }: { scene?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const paint = (name: string) => `url(#${id}-${name})`;
  const city = scene === "city";
  const space = scene === "space";
  const mountain = scene === "mountains";
  return <svg className={`scenery ${className}`} viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${scene} — illustrated concept reference`}>
    <defs>
      <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={city ? "#071c24" : space ? "#090e24" : mountain ? "#5f8589" : "#393239"} /><stop offset=".53" stopColor={city ? "#235359" : space ? "#312a52" : mountain ? "#b8b5a3" : "#c18a65"}/><stop offset="1" stopColor={city ? "#a98058" : space ? "#b28e91" : mountain ? "#e2c3a1" : "#f6cc91"}/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#ffe7b9" stopOpacity=".75"/><stop offset="1" stopColor="#ffe7b9" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-sand`} x1="0" y1="0" x2=".5" y2="1"><stop stopColor="#d5a16e"/><stop offset=".4" stopColor="#a1664a"/><stop offset="1" stopColor="#352d2a"/></linearGradient>
      <linearGradient id={`${id}-ridge`} x2=".8" y2="1"><stop stopColor="#ffe0a2"/><stop offset=".3" stopColor="#b37b50"/><stop offset="1" stopColor="#332a29"/></linearGradient>
      <linearGradient id={`${id}-lake`} x2="0" y2="1"><stop stopColor="#637b7d"/><stop offset="1" stopColor="#152f39"/></linearGradient>
      <linearGradient id={`${id}-planet`} x1="0" x2="1" y2="1"><stop stopColor="#a8c7c7"/><stop offset=".18" stopColor="#546c8c"/><stop offset=".5" stopColor="#17253e"/><stop offset="1" stopColor="#0c1328"/></linearGradient>
      <filter id={`${id}-grain`}><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".1"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
    </defs>
    <path fill={paint("sky")} d="M0 0h1200v760H0z"/>
    <ellipse cx="830" cy="310" rx="400" ry="310" fill={paint("glow")} opacity={city || space ? ".2" : ".8"}/>
    {!city && !space && <circle cx="832" cy="304" r="38" fill="#f8d4a0" opacity=".8"/>}
    {scene === "dunes" && <g>
      <path d="M0 452 180 392 345 433 507 373 627 425 830 370 1027 416 1200 379V760H0" fill="#8d7162" opacity=".46"/>
      <path d="M0 480Q230 439 461 520T1200 410V760H0Z" fill="#ac815f"/>
      <path d="M0 660Q350 267 768 483T1200 520V760H0" fill={paint("sand")}/>
      <path d="M0 660Q350 267 768 483Q455 398 335 610T143 760H0" fill={paint("ridge")}/>
      <path d="M394 448Q566 493 669 595T1200 702V760H426Q458 581 394 448" fill="#3e302c" opacity=".45"/>
      <path d="M585 760Q838 449 1200 562V760" fill={paint("ridge")}/>
      <path d="M0 661Q190 480 392 447" fill="none" stroke="#efbf80" strokeWidth="2" opacity=".75"/>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(n => <path key={n} d={`M0 ${692 + n * 10}Q161 ${511 + n * 13} ${350 + n * 2} ${487 + n * 20}`} fill="none" stroke="#f3cb9d" opacity=".055" strokeWidth="2"/>)}
      <g transform="translate(453 473)"><ellipse cx="11" cy="29" rx="21" ry="2" fill="#342b28" opacity=".4" transform="rotate(16)"/><circle cy="-12" r="3.5" fill="#28292a"/><path d="m-3-8-4 17 6 1-1 13h3l2-13 4 13h3L6 7 3-8Z" fill="#29282a"/><path d="m3-6 8 12 2 11" stroke="#29282a" fill="none" strokeWidth="2"/></g>
    </g>}
    {mountain && <g>
      <path d="m0 390 130-130 123 106 120-200 170 203 128-135 167 140 185-179 177 158v407H0" fill="#7a8d8d"/>
      <path d="m280 366 93-200 170 203-106-73-46 17-29-73Z" fill="#d6d1be"/>
      <path d="m0 442 208-181 188 236 160-195 232 175 256-205 156 166v322H0" fill="#3b5f67"/>
      <path d="m0 555 203-137 134 146 197-91 257 99 200-187 209 189v186H0" fill="#234952"/>
      <path d="M0 585q240-45 400 8t800-4v171H0" fill={paint("lake")}/>
      {Array.from({ length: 15 }, (_, n) => <path key={n} d={`M${240 + n * 13} ${610 + n * 9}h${510 - n * 23}`} stroke="#bbc9bc" opacity=".12"/>)}
      {Array.from({ length: 23 }, (_, n) => <path key={n} d={`M${n * 23 - 10} 760v-130m-20 100 20-88 20 88m-34-28 14-65 15 65`} stroke="#132e33" fill="#132e33" strokeWidth="7"/>)}
    </g>}
    {city && <g>
      <path d="M0 760 562 442h91l547 318" fill="#25424a"/>
      {Array.from({ length: 9 }, (_, n) => <g key={n}>
        <path d={`M${n * 63} ${96 + n * 35}h${84 - n * 4}V${720 - n * 29}h-${84 - n * 4}Z`} fill={n % 2 ? "#13252e" : "#1a3339"}/>
        <path d={`M${1200 - n * 66} ${50 + n * 43}h-${90 - n * 3}V${736 - n * 32}h${90 - n * 3}Z`} fill={n % 2 ? "#192e35" : "#0f242c"}/>
        {Array.from({ length: 5 }, (_, k) => <path key={k} d={`M${n * 63 + 20} ${135 + n * 35 + k * 56}h24v22h-24Zm${1070 - n * 127} 0h23v24h-23Z`} fill={k % 2 ? "#bea278" : "#517278"} opacity=".65"/>)}
      </g>)}
      <path d="M156 338h34v176h-34z" fill="#dd9a65"/><path d="M1029 300h22v260h-22z" fill="#76b9bd"/>
      <path d="m169 614-75 146h140l-54-146M1040 625l-35 135h148l-107-135" fill="#e2aa77" opacity=".17"/>
      <path d="M574 586q30-58 61 0Z" fill="#14272c"/><path d="M605 583v45m-5-22-5 61m10-41 9 41" stroke="#111d25" strokeWidth="8"/>
      {Array.from({ length: 36 }, (_, n) => <path key={n} d={`m${n * 37} ${n % 4 * 113} -28 170`} stroke="#aac5cb" opacity=".13"/>)}
    </g>}
    {space && <g>
      {Array.from({ length: 60 }, (_, n) => <circle key={n} cx={(n * 179) % 1200} cy={(n * 73) % 690} r={n % 3 === 0 ? 1.5 : .7} fill="#efe3cf" opacity=".7"/>)}
      <circle cx="950" cy="980" r="650" fill={paint("planet")} stroke="#acc7d3" strokeWidth="4"/>
      <g transform="translate(570 322) rotate(-28)"><ellipse rx="257" ry="122" fill="none" stroke="#111b2b" strokeWidth="44"/><ellipse cy="-9" rx="257" ry="122" fill="none" stroke="#a7a49c" strokeWidth="20"/><ellipse cy="-12" rx="255" ry="122" fill="none" stroke="#eee1b9" strokeWidth="2"/><path d="M-240 0H240M0-116V112" stroke="#747c83" strokeWidth="7"/><ellipse rx="42" ry="22" fill="#d2c0a1"/></g>
      <path d="m259 548 75 19-47 2-15 18Z" fill="#cbc8bb"/><path d="m279 575-46 52 34-59" fill="#9dccdb" opacity=".5"/>
    </g>}
    <path d="M0 0h1200v760H0z" filter={paint("grain")} opacity=".24"/>
  </svg>;
}
