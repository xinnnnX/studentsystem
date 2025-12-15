const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initTable() {
    const tmp = `DROP TABLE IF EXISTS students;`;
    const createTableSql = `
    CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT NOT NULL,
        "studentId" TEXT NOT NULL UNIQUE,
        "birthDate" DATE NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT NOT NULL
    )`;
    try {
        await pool.query(tmp);
        await pool.query(createTableSql);
        console.log('Table initialized successfully');
    } catch (err) {
        console.error('Create table failed:', err.message);
    }
}

pool.connect((err, client, done) => {
    if (err) {
        console.error('Connection failed:', err.message);
    } else {
        console.log('Connected to PostgreSQL database');
        done();
        initTable();
    }
});

function checkDuplicate(student, id, callback) {
    const studentIdSql = `SELECT 1 FROM students WHERE "studentId" = $1 AND (id != $2 OR $2 IS NULL)`;
    pool.query(studentIdSql, [student.studentId, id], (err, result) => {
        if (err) return callback(err, null);
        if (result.rows.length > 0) {
            return callback(null, { type: 'idErr', msg: 'ID duplicate!' });
        }

        const phoneSql = `SELECT 1 FROM students WHERE phone = $1 AND (id != $2 OR $2 IS NULL)`;
        pool.query(phoneSql, [student.phone, id], (err, result) => {
            if (err) return callback(err, null);
            if (result.rows.length > 0) {
                return callback(null, { type: 'phoneErr', msg: 'Phone duplicate!' });
            }

            const emailSql = `SELECT 1 FROM students WHERE email = $1 AND (id != $2 OR $2 IS NULL)`;
            pool.query(emailSql, [student.email, id], (err, result) => {
                if (err) return callback(err, null);
                if (result.rows.length > 0) {
                    return callback(null, { type: 'emailErr', msg: 'Email duplicate!' });
                }

                const nameSql = `SELECT 1 FROM students WHERE name = $1 AND (id != $2 OR $2 IS NULL)`;
                pool.query(nameSql, [student.name, id], (err, result) => {
                    if (err) return callback(err, null);
                    if (result.rows.length > 0) {
                        return callback(null, { type: 'duplicate', msg: 'Name exists!' });
                    }

                    callback(null, null);
                });
            });
        });
    });
}

module.exports = {
    addStudent: (student, force = false, callback) => {
        const insert = () => {
            const sql = `
                INSERT INTO students (name, gender, "studentId", "birthDate", phone, email, address)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `;
            const params = [
                student.name,
                student.gender,
                student.studentId,
                student.birthDate,
                student.phone,
                student.email,
                student.address
            ];

            pool.query(sql, params, (err, result) => {
                if (err) {
                    return callback({ type: 'error', msg: err.message }, null);
                }
                const newStudent = { id: result.rows[0].id, ...student };
                callback(null, newStudent);
            });
        };

        if (!force) {
            checkDuplicate(student, null, (sysErr, info) => {
                if (sysErr) {
                    return callback({ type: 'error', msg: sysErr.message }, null);
                }
                if (info) {
                    return callback(info, null);
                }
                insert();
            });
        } else {
            insert();
        }
    },

    getStudents: (options, callback) => {
        const { filterColumn, filterKeyword, sortField, sortOrder, page, pageSize } = options;
        let querySql = 'SELECT * FROM students';
        let countSql = 'SELECT COUNT(*) AS total FROM students';
        const params = [];

        if (filterColumn && filterKeyword) {
            const paramIndex = params.length + 1;
            if (filterColumn === 'birthDate') {
                querySql += ` WHERE "${filterColumn}" ILIKE $${paramIndex}`;
                countSql += ` WHERE "${filterColumn}" ILIKE $${paramIndex}`;
                params.push(`%${filterKeyword}%`);
            } else {
                querySql += ` WHERE "${filterColumn}" ILIKE $${paramIndex}`;
                countSql += ` WHERE "${filterColumn}" ILIKE $${paramIndex}`;
                params.push(`%${filterKeyword.toLowerCase()}%`);
            }
        }

        const validSortFields = ['id', 'name', 'gender', 'studentId', 'birthDate', 'phone', 'email', 'address'];
        const sortBy = validSortFields.includes(sortField) ? sortField : 'id';
        const order = sortOrder === 'desc' ? 'DESC' : 'ASC';
        querySql += ` ORDER BY ${sortBy} ${order}`;

        const limitParamIndex = params.length + 1;
        const offsetParamIndex = params.length + 2;
        const offset = (page - 1) * pageSize;
        querySql += ` LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
        params.push(pageSize, offset);

        pool.query(countSql, params.slice(0, params.length - 2), (err, countResult) => {
            if (err) return callback(err);
            const total = parseInt(countResult.rows[0].total);
            const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

            pool.query(querySql, params, (err, studentsResult) => {
                callback(err, {
                    list: studentsResult.rows,
                    total,
                    totalPages: totalPages,
                    currentPage: page
                });
            });
        });
    },

    updateStudent: (id, student, force = false, callback) => {
        const update = () => {
            const sql = `
                UPDATE students
                SET name = $1, gender = $2, "studentId" = $3, "birthDate" = $4, phone = $5, email = $6, address = $7
                WHERE id = $8
                RETURNING *
            `;
            const params = [
                student.name,
                student.gender,
                student.studentId,
                student.birthDate,
                student.phone,
                student.email,
                student.address,
                id
            ];

            pool.query(sql, params, (err, result) => {
                if (err) {
                    return callback({ type: 'error', msg: err.message }, null);
                }
                callback(null, { affectedRows: result.rowCount });
            });
        };

        if (!force) {
            checkDuplicate(student, id, (sysErr, info) => {
                if (sysErr) {
                    return callback({ type: 'error', msg: sysErr.message }, null);
                }
                if (info) {
                    return callback(info, null);
                }
                update();
            });
        } else {
            update();
        }
    },

    deleteStudent: (id, callback) => {
        const sql = 'DELETE FROM students WHERE id = $1';
        pool.query(sql, [id], (err, result) => {
            callback(err, { affectedRows: result.rowCount });
        });
    }
};