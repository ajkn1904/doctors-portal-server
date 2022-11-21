const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express()

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7splzic.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        const appointmentCollection = client.db('doctorsPortal').collection('AppointmentOptions');

        const bookingsCollection = client.db('doctorsPortal').collection('Bookings');

        app.get('/appointmentOptions', async(req, res) => {
            const date = req.query.date
            const query = {}
            const cursor = await appointmentCollection.find(query).toArray();

            const bookingQuery = {selectedDate: date}
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            cursor.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatmentName === option.name);
                const bookedSlots = optionBooked.map(book => book.treatmentSlot)
                const restSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = restSlots;
            });


            res.send(cursor);
        })

        app.post('/bookings', async(req, res) => {
            const booking = req.body;
            const query = {
                email: booking.email,
                selectedDate: booking.selectedDate,
                treatmentName: booking.treatmentName
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray()
            if(alreadyBooked.length){
                const response = `You already have an appointment on ${booking.selectedDate}`
                return res.send({acknowledge: false, response})
            }
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })
    }
    finally{
        
    }
}
run().catch(console.log);

app.get('/', async(req, res) => {
    res.send('Doctors Portal is running');
});

app.listen(port, () => console.log(`Doctors portal is running on ${port}`))
