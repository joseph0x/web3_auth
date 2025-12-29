import React, { useState, useEffect, createContext, useContext } from "react";
import { ethers } from "ethers";
import { AlertCircle, Lock, Zap, Shield, X, Sparkles } from "lucide-react";

// Types
interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface WalletContextType extends WalletState {
  connect: (walletType: "metamask" | "walletconnect") => Promise<void>;
  disconnect: () => void;
  signMessage: () => Promise<string | null>;
}

// Create context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Wallet Provider Component
const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isLoading: false,
    error: null,
  });

  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  // Generate EIP-4361 compliant sign-in message
  const generateSiweMessage = (address: string, chainId: number): string => {
    const domain = window.location.host;
    const origin = window.location.origin;
    const statement = "Sign in to verify your wallet ownership";
    const nonce = Math.random().toString(36).substring(2, 15);
    const issuedAt = new Date().toISOString();

    return `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${origin}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
  };

  // Connect to MetaMask
  const connectMetaMask = async () => {
    if (!window.ethereum) {
      throw new Error(
        "MetaMask is not installed. Please install MetaMask to continue."
      );
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();

    setProvider(provider);
    return { address: accounts[0], chainId: Number(network.chainId) };
  };

  // Connect to WalletConnect (mocked for demo)
  const connectWalletConnect = async () => {
    if (!window.ethereum) {
      throw new Error(
        "WalletConnect requires a Web3 provider. Install MetaMask as fallback."
      );
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();

    setProvider(provider);
    return { address: accounts[0], chainId: Number(network.chainId) };
  };

  // Main connect function
  const connect = async (walletType: "metamask" | "walletconnect") => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result =
        walletType === "metamask"
          ? await connectMetaMask()
          : await connectWalletConnect();

      setState({
        address: result.address,
        chainId: result.chainId,
        isConnected: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Failed to connect wallet",
      }));
    }
  };

  // Sign message for authentication
  const signMessage = async (): Promise<string | null> => {
    if (!provider || !state.address || !state.chainId) {
      setState((prev) => ({ ...prev, error: "Wallet not connected" }));
      return null;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const signer = await provider.getSigner();
      const message = generateSiweMessage(state.address, state.chainId);
      const signature = await signer.signMessage(message);

      setState((prev) => ({ ...prev, isLoading: false }));

      return signature;
    } catch (err: any) {
      const errorMsg =
        err.code === 4001
          ? "Signature rejected by user"
          : "Failed to sign message";

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }));
      return null;
    }
  };

  // Disconnect wallet
  const disconnect = () => {
    setProvider(null);
    setState({
      address: null,
      chainId: null,
      isConnected: false,
      isLoading: false,
      error: null,
    });
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          setState((prev) => ({ ...prev, address: accounts[0] }));
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners();
      }
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{ ...state, connect, disconnect, signMessage }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use wallet context
const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};

// Utility function to shorten address
const shortenAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Get network name from chain ID
const getNetworkName = (chainId: number): string => {
  const networks: Record<number, string> = {
    1: "Ethereum Mainnet",
    5: "Goerli",
    11155111: "Sepolia",
    137: "Polygon",
    80001: "Mumbai",
  };
  return networks[chainId] || `Chain ${chainId}`;
};

// Wallet Selection Modal
const WalletModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { connect, isLoading } = useWallet();

  const handleConnect = async (type: "metamask" | "walletconnect") => {
    await connect(type);
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-fadeIn">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <h2 className="text-3xl font-bold text-black mb-8">Connect Wallet</h2>

        {/* Wallet Options */}
        <div className="space-y-4 mb-6">
          {/* MetaMask */}
          <button
            onClick={() => handleConnect("metamask")}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-2 border-2 border-black rounded-full hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black group-hover:bg-white rounded-full flex items-center justify-center transition-colors">
                <img
                  src="./metamask.png"
                  alt="metamask"
                  className="w-7 h-7 text-white group-hover:text-black transition-colors"
                />
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">MetaMask</p>
                <p className="text-sm text-gray-500 group-hover:text-gray-300">
                  Popular browser wallet
                </p>
              </div>
            </div>
          </button>

          {/* WalletConnect */}
          <button
            onClick={() => handleConnect("walletconnect")}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-2 border-2 border-black rounded-full hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black group-hover:bg-white rounded-full flex items-center justify-center transition-colors">
                <img
                  src="./WalletConnect.png"
                  alt="walletconnect"
                  className="w-7 h-7 text-white group-hover:text-black transition-colors"
                />
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">WalletConnect</p>
                <p className="text-sm text-gray-500 group-hover:text-gray-300">
                  Scan with mobile wallet
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Terms text */}
        <p className="text-center text-sm text-gray-500">
          By connecting, you agree to the Terms of Service.
        </p>
      </div>
    </div>
  );
};

// Landing Page Component
const LandingPage: React.FC<{ onConnectClick: () => void }> = ({
  onConnectClick,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-2xl text-center space-y-8">
        {/* Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Sign-In With Ethereum
          </div>
        </div>

        {/* Main Heading */}
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-black leading-tight">
            Your Wallet,
            <br />
            Your Identity
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-xl mx-auto">
            No passwords. No emails. Just connect
            <br className="hidden sm:block" /> your wallet and sign to
            authenticate.
          </p>
        </div>

        {/* Connect Card */}
        <div className="max-w-md mx-auto">
          <div className="border-2 border-black rounded-3xl p-8 space-y-6 bg-white">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-black">Connect Wallet</h2>
              <p className="text-gray-600">Choose a wallet to get started</p>
            </div>

            <button
              onClick={onConnectClick}
              className="w-full py-4 bg-black text-white font-semibold rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              Connect Wallet
            </button>

            {/* Features */}
            <div className="flex items-center justify-around pt-4 border-t border-gray-200">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Lock className="w-5 h-5 text-black" />
                </div>
                <span className="text-xs font-medium text-gray-700">
                  Secure
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5 text-black" />
                </div>
                <span className="text-xs font-medium text-gray-700">
                  Instant
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-black" />
                </div>
                <span className="text-xs font-medium text-gray-700">
                  Private
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component (After Authentication)
const Dashboard: React.FC = () => {
  const { address, chainId, disconnect, isLoading } = useWallet();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="border-2 border-black rounded-3xl p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-gray-200">
            <div>
              <h2 className="text-3xl font-bold text-black mb-1">
                Welcome Back
              </h2>
              <p className="text-gray-600">You're successfully authenticated</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Wallet Info */}
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">
                  Wallet Address
                </span>
                <span className="font-mono font-bold text-black text-lg">
                  {address ? shortenAddress(address) : ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">
                  Network
                </span>
                <span className="font-bold text-black">
                  {chainId ? getNetworkName(chainId) : ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">
                  Status
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={disconnect}
            disabled={isLoading}
            className="w-full py-4 border-2 border-black text-black font-semibold rounded-full hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    "idle" | "signing" | "authenticated"
  >("idle");

  return (
    <WalletProvider>
      <AppContent
        showModal={showModal}
        setShowModal={setShowModal}
        authStatus={authStatus}
        setAuthStatus={setAuthStatus}
      />
    </WalletProvider>
  );
};

// App Content (needs to be separate to use useWallet hook)
const AppContent: React.FC<{
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  authStatus: "idle" | "signing" | "authenticated";
  setAuthStatus: (status: "idle" | "signing" | "authenticated") => void;
}> = ({ showModal, setShowModal, authStatus, setAuthStatus }) => {
  const { isConnected, signMessage, error } = useWallet();

  // Auto-trigger signing when wallet connects
  useEffect(() => {
    if (isConnected && authStatus === "idle") {
      handleAutoSign();
    }
  }, [isConnected]);

  const handleAutoSign = async () => {
    setAuthStatus("signing");
    const signature = await signMessage();

    if (signature) {
      setAuthStatus("authenticated");
      console.log("Authentication successful! Signature:", signature);
    } else {
      setAuthStatus("idle");
    }
  };

  // Show error notification
  const ErrorNotification = error ? (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 bg-red-50 border-2 border-red-500 rounded-2xl p-4 flex items-start gap-3 shadow-lg z-50 animate-fadeIn">
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-red-900 mb-1">Connection Error</p>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    </div>
  ) : null;

  if (authStatus === "authenticated") {
    return (
      <>
        <Dashboard />
        {ErrorNotification}
      </>
    );
  }

  return (
    <>
      <LandingPage onConnectClick={() => setShowModal(true)} />
      {showModal && <WalletModal onClose={() => setShowModal(false)} />}
      {ErrorNotification}

      {/* Add CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default App;
