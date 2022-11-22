const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express()
const jwt = require('jsonwebtoken');

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send('Unauthorized Access');
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7splzic.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const appointmentCollection = client.db('doctorsPortal').collection('AppointmentOptions');

        const bookingsCollection = client.db('doctorsPortal').collection('Bookings');

        const usersCollection = client.db('doctorsPortal').collection('Users');



        //jwt
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            console.log(user)
            //token implementation
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        })


        //appointments
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date
            const query = {}
            const cursor = await appointmentCollection.find(query).toArray();

            const bookingQuery = { selectedDate: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            cursor.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatmentName === option.name);
                const bookedSlots = optionBooked.map(book => book.treatmentSlot)
                const restSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = restSlots;
            });


            res.send(cursor);
        })




        //bookings
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })


        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                email: booking.email,
                selectedDate: booking.selectedDate,
                treatmentName: booking.treatmentName
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray()
            if (alreadyBooked.length) {
                const response = `You already have an appointment on ${booking.selectedDate}`
                return res.send({ acknowledge: false, response })
            }
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })




        //users

        app.get('/users', async (req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray()
            return res.send(users);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })


        // set admin

        app.get('/users/admin/:email', async(req, res) => {
            const email = req.params.email
            const query = {email}
            const cursor = await usersCollection.findOne(query)
            return res.send({isAdmin: cursor?.role === 'Admin'}) 
        })

        app.put('/users/admin/:id', verifyJWT, async(req, res) => {         
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail}
            const user = await usersCollection.findOne(query)
            if(user.role !== 'Admin'){
                return res.status(403).send({message: 'forbidden access'})
            }

            const id = req.params.id;
            const cursor = {_id: ObjectId(id)}
            const option = {upsert: true} 
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await usersCollection.updateOne(cursor, updatedDoc, option)
            res.send(result);
        })

    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('Doctors Portal is running');
});

app.listen(port, () => console.log(`Doctors portal is running on ${port}`))
