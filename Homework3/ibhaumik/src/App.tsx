import { useState } from 'react';
import Box from '@mui/material/Box';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import CountryTreemap from './components/CountryTreemap';
import MedalTimeline from './components/MedalTimeline';
import DisciplineHeatmap from './components/DisciplineHeatmap';

// Adjust the color theme for material ui
const theme = createTheme({
  palette: {
    primary:{
      main: grey[700],
    },
    secondary:{
      main: grey[700],
    }
  },
})

// For how Grid works, refer to https://mui.com/material-ui/react-grid/

function Layout() {
  const [selectedCountryCode, setSelectedCountryCode] = useState('USA');
  const [selectedCountryName, setSelectedCountryName] = useState('United States');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);

  const handleSelectCountry = (code: string, name: string) => {
    setSelectedCountryCode(code);
    setSelectedCountryName(name);
    setSelectedDiscipline(null);
  };

  return (
    <Box id="main-container">
      <div className="dashboard-title">Paris 2024 Medals: Overview Dashboard</div>
      <div className="dashboard">
        <div className="view-card">
          <CountryTreemap
            selectedCountryCode={selectedCountryCode}
            onSelectCountry={handleSelectCountry}
          />
        </div>
        <div className="view-card">
          <MedalTimeline
            selectedCountryCode={selectedCountryCode}
            selectedCountryName={selectedCountryName}
            selectedDiscipline={selectedDiscipline}
          />
        </div>
        <div className="view-card view-card-wide">
          <DisciplineHeatmap
            selectedCountryCode={selectedCountryCode}
            selectedCountryName={selectedCountryName}
            selectedDiscipline={selectedDiscipline}
            onSelectDiscipline={setSelectedDiscipline}
          />
        </div>
      </div>
    </Box>
  )
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Layout />
    </ThemeProvider>
  )
}

export default App
