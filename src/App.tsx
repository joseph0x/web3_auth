import React, { useState, useEffect, createContext, useContext } from "react";
import { ethers } from "ethers";
import { AlertCircle, Wallet, CheckCircle, Loader2 } from "lucide-react";

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

  // Connect to WalletConnect (mocked for demo - real implementation would use @walletconnect/ethereum-provider)
  const connectWalletConnect = async () => {
    // In production, you would initialize WalletConnect like this:
    // import { EthereumProvider } from '@walletconnect/ethereum-provider'
    // const provider = await EthereumProvider.init({
    //   projectId: 'YOUR_PROJECT_ID',
    //   chains: [1],
    //   showQrModal: true
    // })
    // await provider.connect()

    // For this demo, we'll check if MetaMask is available as fallback
    if (!window.ethereum) {
      throw new Error(
        "WalletConnect requires a Web3 provider. Install MetaMask as fallback."
      );
    }

    // Simulate WalletConnect flow with MetaMask as provider
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

      // In production, send { message, signature, address } to backend for verification
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleConnect("metamask")}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-gray-900">MetaMask</span>
            </div>
            {isLoading && (
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            )}
          </button>

          <button
            onClick={() => handleConnect("walletconnect")}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-gray-900">WalletConnect</span>
            </div>
            {isLoading && (
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          By connecting, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
};

// Main Authentication Component
const AuthPage: React.FC = () => {
  const {
    address,
    chainId,
    isConnected,
    isLoading,
    error,
    disconnect,
    signMessage,
  } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    "idle" | "signing" | "authenticated"
  >("idle");

  const handleSignIn = async () => {
    setAuthStatus("signing");
    const signature = await signMessage();

    if (signature) {
      // Mock successful authentication
      setAuthStatus("authenticated");
      console.log("Authentication successful! Signature:", signature);
    } else {
      setAuthStatus("idle");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setAuthStatus("idle");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Web3 Sign In
            </h1>
            <p className="text-gray-600">Connect your wallet to continue</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Connected State */}
          {isConnected && address && chainId ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Address</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {shortenAddress(address)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Network</span>
                  <span className="font-semibold text-gray-900">
                    {getNetworkName(chainId)}
                  </span>
                </div>
              </div>

              {authStatus === "authenticated" ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">
                      Authenticated
                    </p>
                    <p className="text-sm text-green-700">
                      You're signed in successfully
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {authStatus === "signing"
                        ? "Signing Message..."
                        : "Connecting..."}
                    </>
                  ) : (
                    "Sign Message to Authenticate"
                  )}
                </button>
              )}

              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </button>
          )}

          {/* Info Text */}
          <p className="text-xs text-center text-gray-500 mt-6">
            No passwords or emails required. Your wallet is your identity.
          </p>
        </div>
      </div>

      {/* Wallet Selection Modal */}
      {showModal && <WalletModal onClose={() => setShowModal(false)} />}
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <WalletProvider>
      <AuthPage />
    </WalletProvider>
  );
};

export default App;
