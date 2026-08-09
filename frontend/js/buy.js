const regionSelect = document.getElementById("regionSelect");
const countrySelect = document.getElementById("countrySelect");
const networkContainer = document.getElementById("networkContainer");
const cryptoSelect = document.getElementById("cryptoSelect");
const amountInput = document.getElementById("amountInput");

const priceElement = document.getElementById("price");
const receiveElement = document.getElementById("receive");
const continueBtn = document.getElementById("continueBtn");

let selectedCountry = null;
let selectedNetwork = null;

// -------------------------
// Charger les pays
// -------------------------

regionSelect.addEventListener("change", () => {

    countrySelect.innerHTML =
        `<option value="">Choisir un pays</option>`;

    networkContainer.innerHTML = "";

    selectedCountry = null;
    selectedNetwork = null;

    const region = REGIONS[regionSelect.value];

    if (!region) return;

    region.countries.forEach(country => {

        const option = document.createElement("option");

        option.value = country.code;

        option.textContent = country.name;

        countrySelect.appendChild(option);

    });

});

// -------------------------
// Charger les réseaux
// -------------------------

countrySelect.addEventListener("change", () => {

    networkContainer.innerHTML = "";

    selectedNetwork = null;

    const region = REGIONS[regionSelect.value];

    if (!region) return;

    selectedCountry = region.countries.find(
        c => c.code === countrySelect.value
    );

    if (!selectedCountry) return;

    selectedCountry.networks.forEach(network => {

        const card = document.createElement("div");

        card.className = "network-card";

        card.innerHTML = `

            <img src="${network.logo}" alt="${network.name}">

            <div>

                <h4>${network.name}</h4>

            </div>

        `;

        card.onclick = () => {

            document
                .querySelectorAll(".network-card")
                .forEach(c => c.classList.remove("active"));

            card.classList.add("active");

            selectedNetwork = network;

            validate();

        };

        networkContainer.appendChild(card);

    });

});

// -------------------------
// Calcul
// -------------------------

function calculate(){

    const crypto = cryptoSelect.value;

    const amount = parseFloat(amountInput.value);

    if(!crypto || !amount){

        priceElement.innerHTML = "0 FCFA";

        receiveElement.innerHTML = "0";

        return;

    }

    const rate = RATES[crypto].buy;

    const receive = amount / rate;

    priceElement.innerHTML = rate.toLocaleString()+" FCFA";

    receiveElement.innerHTML =
        receive.toFixed(4)+" "+crypto;

}

// -------------------------

cryptoSelect.addEventListener("change",()=>{

    calculate();

    validate();

});

amountInput.addEventListener("input",()=>{

    calculate();

    validate();

});

// -------------------------

function validate(){

    if(

        regionSelect.value &&

        countrySelect.value &&

        selectedNetwork &&

        cryptoSelect.value &&

        amountInput.value

    ){

        continueBtn.disabled = false;

    }

    else{

        continueBtn.disabled = true;

    }

}

continueBtn.disabled = true;

// -------------------------

continueBtn.addEventListener("click",()=>{

    const crypto = cryptoSelect.value;

    const amount = parseFloat(amountInput.value);

    const rate = RATES[crypto].buy;

    const receive = amount/rate;

    const transaction={

        type:"buy",

        region:regionSelect.value,

        country:selectedCountry.name,

        network:selectedNetwork.name,

        crypto,

        amount,

        rate,

        receive

    };

    localStorage.setItem(

        "buyTransaction",

        JSON.stringify(transaction)

    );

    alert("Étape suivante : confirmation de la transaction.");

    // Plus tard :
    // window.location.href="buy-confirm.html";

});
