const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Ensure uploads and output folders exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Serve uploads and output folders for image preview
app.use('/uploads', express.static(uploadsDir));
app.use('/output', express.static(outputDir));

const upload = multer({ dest: 'uploads/' });

// Home page
app.get('/', (req, res) => {
    res.render('index', { result: null, error: null });
});

// Upload Handler
app.post('/upload', upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) throw new Error('No file uploaded.');

        const inputPath = path.join(__dirname, req.file.path);
        const outputPath = path.join(outputDir, `no-bg-${req.file.filename}.png`);

        const formData = new FormData();
        formData.append('size', 'auto');
        formData.append('image_file', fs.createReadStream(inputPath));

        const response = await axios.post(
            'https://api.remove.bg/v1.0/removebg',
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'X-Api-Key': process.env.REMOVE_BG_API_KEY
                },
                responseType: 'arraybuffer'
            }
        );

        fs.writeFileSync(outputPath, response.data);

        res.render('index', {
            result: {
                id: req.file.filename,
                original: `/uploads/${req.file.filename}`,
                removed: `/output/no-bg-${req.file.filename}.png`
            },
            error: null
        });
    } catch (error) {
        next(error);
    }
});

// Download and cleanup handler
app.get('/download/:id', (req, res) => {
    const id = req.params.id;
    const inputPath = path.join(uploadsDir, id);
    const outputPath = path.join(outputDir, `no-bg-${id}.png`);

    res.download(outputPath, `no-bg-${id}.png`, (err) => {
        // After download, delete both files
        fs.unlink(outputPath, () => {});
        fs.unlink(inputPath, () => {});
        if (err) console.error('Download error:', err);
    });
});

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('index', { result: null, error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
