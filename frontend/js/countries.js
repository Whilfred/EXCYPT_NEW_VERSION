const REGIONS = {
    west: {
        name: "Afrique de l'Ouest",
        countries: [
            {
                code: "BJ",
                name: "Bénin",
                flag: "../assets/flags/benin.png",
                currency: "FCFA",
                networks: [
                    {
                        name: "MTN",
                        logo: "../assets/payments/mtn.png"
                    },
                    {
                        name: "Moov",
                        logo: "../assets/payments/moov.png"
                    }
                ]
            },
            {
                code: "BF",
                name: "Burkina Faso",
                flag: "../assets/flags/burkina.png",
                currency: "FCFA",
                networks: [
                    {
                        name: "Orange Money",
                        logo: "../assets/payments/orange.png"
                    },
                    {
                        name: "Moov",
                        logo: "../assets/payments/moov.png"
                    }
                ]
            },
            {
                code: "CI",
                name: "Côte d'Ivoire",
                flag: "../assets/flags/cotedivoire.png",
                currency: "FCFA",
                networks: [
                    {
                        name: "Orange Money",
                        logo: "../assets/payments/orange.png"
                    },
                    {
                        name: "MTN",
                        logo: "../assets/payments/mtn.png"
                    },
                    {
                        name: "Wave",
                        logo: "../assets/payments/wave.png"
                    },
                    {
                        name: "Moov",
                        logo: "../assets/payments/moov.png"
                    }
                ]
            }
        ]
    },

    central: {
        name: "Afrique Centrale",
        countries: [
            {
                code: "CM",
                name: "Cameroun",
                flag: "../assets/flags/cameroun.png",
                currency: "FCFA",
                networks: [
                    {
                        name: "MTN",
                        logo: "../assets/payments/mtn.png"
                    },
                    {
                        name: "Orange Money",
                        logo: "../assets/payments/orange.png"
                    }
                ]
            }
        ]
    },

    east: {
        name: "Afrique de l'Est",
        countries: [
            {
                code: "KE",
                name: "Kenya",
                flag: "../assets/flags/kenya.png",
                currency: "KES",
                networks: [
                    {
                        name: "M-Pesa",
                        logo: "../assets/payments/mpesa.png"
                    }
                ]
            }
        ]
    }
};
