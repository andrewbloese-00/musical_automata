//localhostimport "./style.css";
import "./style.css"

const MOORE_NEIGHBORHOOD = [
	[-1,-1], [0,-1], [1,-1],
	[-1,0], [1,0],
	[-1,1], [0,1],[1,1]
]

const VON_NEUMANN_NEIGHBORHOOD = [ 
	[0,-1],
	[-1,0], [1,0],
	[0,1]
]


type CellularNeighborhood = "moore"|"von_neuman"

class MusicalAutomaton {

	static cellPx:number = 5;
	spawn:number
	survival:number
	state:number
	neighborhood:number[][]
	cells:number[][]
	_clone:number[][]
	dimensions:number[]
	changes:number[][]
	constructor(spawn:number, survival:number, state:number, neighborhood:CellularNeighborhood){

		//set neighborhood offsets
		if(neighborhood == "moore") this.neighborhood = MOORE_NEIGHBORHOOD;
		else this.neighborhood = VON_NEUMANN_NEIGHBORHOOD

		this.changes = [] 
		const w = window.innerWidth, h = window.innerHeight; 
		const cellsX = w/MusicalAutomaton.cellPx , cellsY = h / MusicalAutomaton.cellPx;
		const cells:number[][] = [] 
		const clone:number[][] = [] 
		for(let y = 0; y < cellsY; y++){
			cells[y] = []
			clone[y] = [] 
			for(let x = 0; x < cellsX; x++){
				cells[y][x] = 0;
				clone[y][x] = 0;
				this.changes.push([x,y])
			}
		}
		this.cells = cells; 
		this._clone = clone;
		this.spawn = spawn;
		this.survival = survival; 
		this.state = state;
		this.dimensions = [ cellsX,cellsY ]

	}


	countLiveNeighbors(x:number,y:number,r=1){
		let alive = 0; 
		for( const [dx,dy] of this.neighborhood){
			const [nX,nY] = [x+dx,y+dy]
			//skip out of bounds 
			if(nX < 0 || nY < 0 || nX >= this.dimensions[0] || nY >= this.dimensions[1]) continue;
			
			//live neighbor
			if(this._clone[nY][nX] > 0) 
				alive += (r == 1) ? 1 : (1 + this.countLiveNeighbors(nX,nY,r-1))
		}
		return alive; 
	}

	#copyCells(){	
		for(let y = 0; y < this.dimensions[1]; y++){
			for(let x = 0; x < this.dimensions[0]; x++){
				this._clone[y][x] = this.cells[y][x]
			}
		}
	}

	/**
	 * @param {number} r how many cells out in each neighbor direction (default 1 -> immediate neighbors)
	 */
	automataTick(r=1){
		//writes cell data to _clone
		this.changes = []; 
		this.#copyCells();
		for(let y = 0; y < this.dimensions[1]; y++){
			for(let x = 0; x < this.dimensions[0]; x++){
				const alive = this.countLiveNeighbors(x,y,r);
				if(this._clone[y][x] == 0){
					if(alive >= this.spawn) {
						this.cells[y][x] = this.state;
						this.changes.push([x,y])
					}
				} else { 
					//check survival condition (account for overpop)
					if(alive != this.survival){
						this.cells[y][x] = Math.max(0,this.cells[y][x]-1);
						this.changes.push([x,y])
					}
				} 
			} //end x for
		}//end y for
	}//end automata tick
}



class AudioEnvironment { 
	static env:AudioEnvironment | null = null;
	static async init(){
		if(AudioEnvironment.env) return AudioEnvironment.env;	
		try { 
			const context = new AudioContext()
			const stream = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
			AudioEnvironment.env = new AudioEnvironment(stream,context);
			return AudioEnvironment.env;
		} catch (error){
			console.error("Failed to initialize AudioEnvironment\nReason:",error);
			return null;
		}

	}

	src:MediaStreamAudioSourceNode;
	analyser:AnalyserNode; 
	frequencyData:Uint8Array;
	_ctx:AudioContext;
	constructor(stream:MediaStream,context:AudioContext){
		this.src = context.createMediaStreamSource(stream);	
		this.analyser = context.createAnalyser()
		this.src.connect(this.analyser);
		this._ctx = context;
		this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
	}

	scan(){
		this.analyser.getByteFrequencyData(this.frequencyData);
	}
}


const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas)
const context = canvas.getContext("2d");




function drawAutomaton(a:MusicalAutomaton,colors:string[]){
	if (!context) return console.warn("canvas not supported in your browser...");
	const px = MusicalAutomaton.cellPx;
	for(const [x,y] of a.changes){
		const colorIdx = a.cells[y][x];
		context.fillStyle = colors[colorIdx]
		context.fillRect(x*px,y*px,px,px)
	}
}









async function main(){
	const welcomeText = document.querySelector("#welcome")
	document.body.removeEventListener("click",main);
	if(welcomeText) welcomeText.remove()

	const ma = new MusicalAutomaton(3,3,5,"moore");
	canvas.addEventListener("mousemove", (e:MouseEvent)=>{
		//is this correct?
		const rect = canvas.getBoundingClientRect()
		const canvasX = e.clientX - rect.left,
			canvasY = e.clientY - rect.top;
			
		
		//ignore oob
		if (canvasX < 0 || canvasX > canvas.width || canvasY < 0 || canvasY > canvas.height) return;
		const cellX = Math.floor(canvasX / MusicalAutomaton.cellPx), 
			cellY = Math.floor(canvasY /MusicalAutomaton.cellPx);

		
		if(!ma.cells[cellY][cellX]) ma.cells[cellY][cellX] = ma.state
		else {
			let k = 0
			for(const [oX,oY] of ma.neighborhood){
				const nX = oX + cellX
				const nY = oY + cellY
				if(nX < 0 || nX >= ma.dimensions[0] || nY < 0 || nY >= ma.dimensions[1]) continue
				ma.cells[nY][nX] = Math.max(0,ma.cells[nY][nX]-k)
				k++


			}
		}



	})


	const audio = await AudioEnvironment.init()
	if(!audio) return;
	const surv = ma.survival, st = ma.state
	const colors = [ 'black','violet','indigo','purple','lime', 'royalblue'];
	function animate(){
		ma.automataTick();
		if(audio){
			audio.scan();
			let s = 0, sb = 0
			for(let y = 0; y < ma.dimensions[1]; y++){
				for(let x = 0; x < ma.dimensions[0]; x++){
					const fftBin = (x*y) % audio.analyser.frequencyBinCount;
					const volume = audio.frequencyData[fftBin] || 0;
					s+= volume
					if(fftBin == audio.frequencyData.length/2)
						sb = s;
					if(volume > 100){
						const newState = Math.floor(ma.state * (volume/255))
						ma.cells[y][x] = Math.max(newState,ma.cells[y][x])
						const n = audio.analyser.frequencyBinCount
						if (sb / (n/2) > 70 && Math.random() > 0.9){
							ma.survival = (ma.survival+1) % surv * 2
							ma.spawn =  (ma.spawn+1) % ma.neighborhood.length + 1
							if(Math.random() > 0.9)
								ma.state = Math.max(3,(ma.state+1) % st)
						}

					}
					

				}
			}
			canvas.style.filter = `hue-rotate(${s/audio.analyser.frequencyBinCount}deg)`
		}
		drawAutomaton(ma,colors); 
		setTimeout(()=>requestAnimationFrame(animate), 50);
	}
	animate();

}

document.body.addEventListener("click",main)

