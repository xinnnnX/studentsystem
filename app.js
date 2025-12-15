const express = require('express');
const cors = require('cors');
const db = require('./db');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

const allowedOrigins = [
    'https://xinnnnx.github.io',
    'https://xinnnnx.github.io/studentsystem',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/students', (req, res) => {
    const { student, force = false } = req.body;

    db.addStudent(student, force, (err, result) => {
        if (err) {
            if (err.type === 'duplicate') {
                return res.status(200).json({ code: 1, type: err.type, msg: err.msg });
            }
            else if (err.type === 'idErr') {
                return res.status(500).json({ code: -2, type: err.type, msg: err.msg });
            }
            else if (err.type === 'phoneErr') {
                return res.status(500).json({ code: -3, type: err.type, msg: err.msg });
            }
            else if (err.type === 'emailErr') {
                return res.status(500).json({ code: -4, type: err.type, msg: err.msg });
            }
            else if (err.type === 'error') {
                return res.status(500).json({ code: -1, type: err.type, msg: err.msg });
            }
        }

        res.status(200).json({ code: 0, data: result });
    });
});

app.get('/api/students', (req, res) => {
    const options = {
        filterColumn: req.query.filterColumn || '',
        filterKeyword: req.query.filterKeyword || '',
        sortField: req.query.sortField || 'id',
        sortOrder: req.query.sortOrder || 'asc',
        page: parseInt(req.query.page) || 1,
        pageSize: parseInt(req.query.pageSize) || 10
    };
    db.getStudents(options, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        res.status(200).json({ success: true, data: result });
    });
});

app.put('/api/students/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { student, force } = req.body;
    db.updateStudent(id, student, force, (err, result) => {
        if (err) {
            if (err.type === 'duplicate') {
                return res.status(200).json({ code: 1, type: err.type, msg: err.msg });
            }
            else if (err.type === 'idErr') {
                return res.status(500).json({ code: -2, type: err.type, msg: err.msg });
            }
            else if (err.type === 'phoneErr') {
                return res.status(500).json({ code: -3, type: err.type, msg: err.msg });
            }
            else if (err.type === 'emailErr') {
                return res.status(500).json({ code: -4, type: err.type, msg: err.msg });
            }
            else if (err.type === 'error') {
                return res.status(500).json({ code: -1, type: err.type, msg: err.msg });
            }
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ code: -1, msg: `Student No.${id} does not exist, please check!` });
        }

        res.status(200).json({ code: 0, data: { id, ...student } });
    });
});

app.delete('/api/students/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.deleteStudent(id, (err, result) => {
        if (err)
            return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0)
            return res.status(404).json({ success: false, message: `Student No.${id} does not exist, please check!` });
        res.status(200).json({ success: true });
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});